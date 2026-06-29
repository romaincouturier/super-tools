import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";

interface GameDevisItem {
  title: string;
  quantity: number;
  unitPrice: number;
}

interface RequestBody {
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  items: GameDevisItem[];
  fraisDePort: number;
  fraisDossier: number;
  noteDevis: string;
  crmCardId?: string;
  senderEmail?: string;
}

const GAME_DEVIS_TEMPLATE_ID = "C5099C66-FB36-49F3-B674-2F8C1A2F314A";

async function generatePdf(data: RequestBody): Promise<{ pdfUrl: string; documentId: string }> {
  const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
  if (!pdfMonkeyApiKey) throw new Error("PDFMONKEY_API_KEY is not set");

  const payload = {
    client: {
      name: data.nomClient,
      address: data.adresseClient,
      zip: data.codePostalClient,
      city: data.villeClient,
      country: data.pays,
    },
    items: data.items.map((i) => ({
      name: i.title,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
    shipping_fee: data.fraisDePort || 0,
    admin_fee: data.fraisDossier || 0,
    note: data.noteDevis || "",
  };

  const createRes = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pdfMonkeyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: {
        document_template_id: GAME_DEVIS_TEMPLATE_ID,
        payload,
        status: "pending",
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`PdfMonkey create error: ${err}`);
  }

  const { document } = await createRes.json();
  const documentId: string = document.id;

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${pdfMonkeyApiKey}` },
    });
    if (!statusRes.ok) throw new Error("PdfMonkey status check failed");
    const { document: doc } = await statusRes.json();
    if (doc.status === "success") return { pdfUrl: doc.download_url, documentId };
    if (doc.status === "failure") throw new Error(`PdfMonkey failed: ${doc.failure_cause}`);
  }

  throw new Error("PdfMonkey timed out");
}

serve(async (req) => {
  const corsRes = handleCorsPreflightIfNeeded(req);
  if (corsRes) return corsRes;

  const authedUser = await verifyAuth(req.headers.get("Authorization"));
  if (!authedUser) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestBody = await req.json();

    if (!body.emailCommanditaire || !body.items?.length) {
      return new Response(JSON.stringify({ error: "Champs obligatoires manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pdfUrl, documentId } = await generatePdf(body);
    console.log(`PDF generated: ${documentId}`);

    const supabase = getSupabaseClient();

    // Persist PDF to storage
    let storagePath: string | null = null;
    try {
      const pdfRes = await fetch(pdfUrl);
      if (pdfRes.ok) {
        const pdfBuffer = await pdfRes.arrayBuffer();
        const folder = body.crmCardId || "unlinked";
        const path = `${folder}/${Date.now()}_jeux.pdf`;
        const { error } = await supabase.storage.from("devis-pdfs").upload(path, pdfBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (!error) storagePath = path;
      }
    } catch (e) {
      console.warn("PDF storage failed:", e);
    }

    // Log activity
    const subtotal = body.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const totalHT = subtotal + (body.fraisDePort || 0) + (body.fraisDossier || 0);
    let activityLogId: string | null = null;
    try {
      const { data: log } = await supabase.from("activity_logs").insert({
        action_type: "game_devis_sent",
        recipient_email: body.emailCommanditaire,
        details: {
          crm_card_id: body.crmCardId || null,
          total_amount: totalHT,
          client_name: body.nomClient,
          items: body.items,
          shipping_fee: body.fraisDePort,
          admin_fee: body.fraisDossier,
          pdf_url: pdfUrl,
          pdf_storage_path: storagePath,
        },
      }).select("id").single();
      activityLogId = log?.id || null;
    } catch (e) {
      console.warn("Activity log failed:", e);
    }

    // Send email
    const emailSignature = await getSigniticSignature();
    const pdfBytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    const itemsHtml = body.items
      .map((i) => `<li>${i.title} × ${i.quantity}</li>`)
      .join("\n");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; padding: 20px; font-size:14px; line-height:1.6; color:#222;">
        <p>Bonjour ${body.adresseCommanditaire || body.emailCommanditaire},</p>
        <p>Veuillez trouver ci-joint votre devis pour les jeux suivants :</p>
        <ul style="margin:8px 0;padding-left:20px;">${itemsHtml}</ul>
        ${body.noteDevis ? `<p style="margin-top:12px;"><em>${body.noteDevis}</em></p>` : ""}
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <p>À très bientôt,</p>
        ${emailSignature || ""}
      </div>
    `;

    await sendEmail({
      from: senderFrom,
      to: [body.emailCommanditaire],
      bcc: bccList,
      subject: `Votre devis jeux — ${body.nomClient}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Devis_jeux_${body.nomClient.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          content: base64Encode(pdfBytes),
        },
      ],
      _emailType: "game_devis",
    });

    // Track in CRM if linked
    if (body.crmCardId) {
      try {
        const { getSenderEmail } = await import("../_shared/email-settings.ts");
        const contactEmail = await getSenderEmail();
        await supabase.from("crm_card_emails").insert({
          card_id: body.crmCardId,
          sender_email: body.senderEmail || contactEmail,
          recipient_email: body.emailCommanditaire,
          subject: `Votre devis jeux — ${body.nomClient}`,
          body_html: htmlContent,
          attachment_names: [`Devis_jeux_${body.nomClient.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`],
        });
        await supabase.from("crm_activity_log").insert({
          card_id: body.crmCardId,
          action_type: "email_sent",
          old_value: null,
          new_value: `Devis jeux envoyé à ${body.emailCommanditaire}`,
          metadata: { source: "game_devis" },
          actor_email: body.senderEmail || contactEmail,
        });
      } catch (e) {
        console.warn("CRM tracking failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, pdfUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    await reportEdgeError(error, { fn: "generate-game-devis" });
    console.error("generate-game-devis error:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
