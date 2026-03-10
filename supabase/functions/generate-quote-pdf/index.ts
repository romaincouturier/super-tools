import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, key);

    // Fetch quote data
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteErr || !quote) throw new Error("Quote not found");

    // Fetch settings
    const { data: settings } = await supabase
      .from("quote_settings")
      .select("*")
      .limit(1)
      .single();

    const lineItems = (quote.line_items as any[]) || [];
    const formatEur = (n: number) =>
      new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    // Generate PDF via PdfMonkey
    const pdfMonkeyKey = Deno.env.get("PDFMONKEY_API_KEY");

    if (!pdfMonkeyKey) {
      // Fallback: generate a simple HTML-based PDF using a data URL approach
      // For now, return the quote data as structured JSON for client-side PDF generation
      return new Response(
        JSON.stringify({
          fallback: true,
          quote,
          settings,
          message: "PDF generation via PdfMonkey not configured. Use client-side generation.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build PdfMonkey payload
    const payload = {
      document: {
        document_template_id: Deno.env.get("PDFMONKEY_QUOTE_TEMPLATE_ID") || "",
        status: "pending",
        payload: {
          quote_number: quote.quote_number,
          issue_date: quote.issue_date,
          expiry_date: quote.expiry_date,
          // Emitter
          company_name: settings?.company_name || "",
          company_address: settings?.company_address || "",
          company_zip: settings?.company_zip || "",
          company_city: settings?.company_city || "",
          company_email: settings?.company_email || "",
          company_phone: settings?.company_phone || "",
          company_logo_url: settings?.company_logo_url || "",
          siren: settings?.siren || "",
          vat_number: settings?.vat_number || "",
          rcs_number: settings?.rcs_number || "",
          rcs_city: settings?.rcs_city || "",
          ape_code: settings?.ape_code || "",
          training_declaration_number: settings?.training_declaration_number || "",
          // Client
          client_company: quote.client_company,
          client_address: quote.client_address,
          client_zip: quote.client_zip,
          client_city: quote.client_city,
          client_vat_number: quote.client_vat_number || "",
          client_siren: quote.client_siren || "",
          // Lines
          line_items: lineItems.map((l: any) => ({
            product: l.product,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price_ht: formatEur(l.unit_price_ht),
            vat_rate: l.vat_rate,
            total_ht: formatEur(l.quantity * l.unit_price_ht),
          })),
          // Totals
          total_ht: formatEur(quote.total_ht || 0),
          total_vat: formatEur(quote.total_vat || 0),
          total_ttc: formatEur(quote.total_ttc || 0),
          // Sale type
          sale_type: quote.sale_type || "",
          // Rights transfer
          rights_transfer_enabled: quote.rights_transfer_enabled,
          rights_transfer_rate: quote.rights_transfer_rate,
          rights_transfer_amount: quote.rights_transfer_amount
            ? formatEur(quote.rights_transfer_amount)
            : "",
          rights_transfer_clause: settings?.rights_transfer_clause || "",
          // Payment
          payment_terms_text: settings?.payment_terms_text || "",
          early_payment_discount: settings?.early_payment_discount || "",
          late_penalty_text: settings?.late_penalty_text || "",
          recovery_indemnity_amount: settings?.recovery_indemnity_amount
            ? formatEur(settings.recovery_indemnity_amount)
            : "",
          payment_methods: settings?.payment_methods || "",
          bank_name: settings?.bank_name || "",
          bank_iban: settings?.bank_iban || "",
          bank_bic: settings?.bank_bic || "",
          // Insurance
          insurance_name: settings?.insurance_name || "",
          insurance_policy_number: settings?.insurance_policy_number || "",
          // VAT exempt
          vat_exempt: settings?.vat_exempt || false,
          vat_exempt_text: settings?.vat_exempt_text || "",
        },
      },
    };

    // Create document in PdfMonkey
    const pmRes = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pdfMonkeyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!pmRes.ok) {
      const errText = await pmRes.text();
      throw new Error(`PdfMonkey API error: ${pmRes.status} — ${errText}`);
    }

    const pmData = await pmRes.json();
    const docId = pmData.document?.id;

    if (!docId) throw new Error("PdfMonkey did not return a document ID");

    // Poll for completion (max 30 seconds)
    let pdfUrl = "";
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const checkRes = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${docId}`, {
        headers: { Authorization: `Bearer ${pdfMonkeyKey}` },
      });
      const checkData = await checkRes.json();
      const status = checkData.document?.status;

      if (status === "success") {
        pdfUrl = checkData.document.download_url;
        break;
      }
      if (status === "failure") {
        throw new Error("PdfMonkey document generation failed");
      }
    }

    if (!pdfUrl) throw new Error("PdfMonkey timeout — document not ready");

    // Save PDF path to quote
    await supabase
      .from("quotes")
      .update({ pdf_path: pdfUrl })
      .eq("id", quoteId);

    return new Response(
      JSON.stringify({ pdfUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-quote-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
