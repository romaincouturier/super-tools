import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Lightweight edge function to refresh an expired PDFMonkey S3 URL
 * for a convention signature. Takes a token, checks the stored URL,
 * refreshes via PdfMonkey API if needed, uploads to permanent storage,
 * updates the DB, and returns the permanent URL.
 */
serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the convention signature record
    const { data: sig, error: fetchError } = await supabase
      .from("convention_signatures")
      .select("id, token, pdf_url, training_id, formation_name, client_name, status")
      .eq("token", token)
      .single();

    if (fetchError || !sig) {
      return new Response(
        JSON.stringify({ error: "Convention introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentUrl = sig.pdf_url;

    // If already a permanent storage URL, return it directly
    if (!currentUrl.includes("X-Amz-Signature")) {
      return new Response(
        JSON.stringify({ pdf_url: currentUrl, refreshed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to fetch the current URL to check if it's still valid
    let pdfResponse = await fetch(currentUrl);

    if (pdfResponse.ok) {
      // URL still valid - upload to permanent storage
      const pdfBuffer = await pdfResponse.arrayBuffer();
      const permanentUrl = await uploadToPermanentStorage(
        supabase, pdfBuffer, sig.training_id, sig.id
      );

      if (permanentUrl) {
        // Update DB with permanent URL
        await supabase
          .from("convention_signatures")
          .update({ pdf_url: permanentUrl })
          .eq("id", sig.id);

        return new Response(
          JSON.stringify({ pdf_url: permanentUrl, refreshed: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If upload failed, return the still-valid URL
      return new Response(
        JSON.stringify({ pdf_url: currentUrl, refreshed: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL expired - refresh via PdfMonkey API
    console.log("PDF URL expired, refreshing via PdfMonkey API");
    const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
    const docIdMatch = currentUrl.match(/\/document\/([0-9a-f-]{36})\//i);

    if (!pdfMonkeyApiKey || !docIdMatch) {
      return new Response(
        JSON.stringify({ error: "Impossible de rafraîchir l'URL du PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentId = docIdMatch[1];
    console.log("Refreshing download URL for PdfMonkey document:", documentId);

    const pmResponse = await fetch(
      `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
      { headers: { Authorization: `Bearer ${pdfMonkeyApiKey}` } }
    );

    if (!pmResponse.ok) {
      console.error("PdfMonkey API call failed:", pmResponse.status);
      return new Response(
        JSON.stringify({ error: "Impossible de récupérer une nouvelle URL depuis PdfMonkey" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pmData = await pmResponse.json();
    const freshUrl = pmData?.document?.download_url;

    if (!freshUrl) {
      return new Response(
        JSON.stringify({ error: "PdfMonkey n'a pas retourné d'URL de téléchargement" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download with fresh URL and upload to permanent storage
    pdfResponse = await fetch(freshUrl);
    if (!pdfResponse.ok) {
      // At least update with the fresh temporary URL
      await supabase
        .from("convention_signatures")
        .update({ pdf_url: freshUrl })
        .eq("id", sig.id);

      return new Response(
        JSON.stringify({ pdf_url: freshUrl, refreshed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const permanentUrl = await uploadToPermanentStorage(
      supabase, pdfBuffer, sig.training_id, sig.id
    );

    const finalUrl = permanentUrl || freshUrl;

    // Update DB
    await supabase
      .from("convention_signatures")
      .update({ pdf_url: finalUrl })
      .eq("id", sig.id);

    console.log("PDF URL refreshed and stored permanently:", finalUrl);

    return new Response(
      JSON.stringify({ pdf_url: finalUrl, refreshed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function uploadToPermanentStorage(
  supabase: any,
  pdfBuffer: ArrayBuffer,
  trainingId: string,
  signatureId: string
): Promise<string | null> {
  try {
    const storagePath = `conventions/${trainingId}/convention_${signatureId}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("training-documents")
      .upload(storagePath, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.warn("Failed to upload PDF to permanent storage:", uploadErr);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("training-documents")
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (err) {
    console.error("Storage upload error:", err);
    return null;
  }
}
