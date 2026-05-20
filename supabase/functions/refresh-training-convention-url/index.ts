import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Refresh an expired PdfMonkey S3 URL for a training convention
 * (intra/global) or a participant convention (inter/e-learning).
 * Re-fetches a fresh download URL from PdfMonkey, uploads to permanent
 * Supabase Storage, updates DB and returns the permanent URL.
 */
serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId, participantId } = await req.json();
    if (!trainingId && !participantId) {
      return json({ error: "trainingId ou participantId requis" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let currentUrl: string | null = null;
    let table: "trainings" | "training_participants";
    let rowId: string;
    let documentId: string | null = null;
    let trainingForPath: string;

    if (participantId) {
      const { data, error } = await supabase
        .from("training_participants")
        .select("id, training_id, convention_file_url, convention_document_id")
        .eq("id", participantId)
        .single();
      if (error || !data) return json({ error: "Participant introuvable" }, 404);
      currentUrl = data.convention_file_url;
      documentId = data.convention_document_id ?? null;
      table = "training_participants";
      rowId = data.id;
      trainingForPath = data.training_id;
    } else {
      const { data, error } = await supabase
        .from("trainings")
        .select("id, convention_file_url")
        .eq("id", trainingId)
        .single();
      if (error || !data) return json({ error: "Formation introuvable" }, 404);
      currentUrl = data.convention_file_url;
      table = "trainings";
      rowId = data.id;
      trainingForPath = data.id;
    }

    if (!currentUrl) return json({ error: "Aucune convention générée" }, 404);

    // If already a permanent storage URL, return as-is
    if (!currentUrl.includes("X-Amz-Signature")) {
      return json({ pdf_url: currentUrl, refreshed: false }, 200);
    }

    // Try current URL first
    let pdfResponse = await fetch(currentUrl);

    if (!pdfResponse.ok) {
      // Expired - refresh via PdfMonkey
      const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
      if (!documentId) {
        const docIdMatch = currentUrl.match(/\/document\/([0-9a-f-]{36})\//i);
        documentId = docIdMatch?.[1] ?? null;
      }
      if (!pdfMonkeyApiKey || !documentId) {
        return json({ error: "Impossible de rafraîchir l'URL du PDF" }, 500);
      }

      console.log("Refreshing PdfMonkey document:", documentId);
      const pmResponse = await fetch(
        `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
        { headers: { Authorization: `Bearer ${pdfMonkeyApiKey}` } }
      );
      if (!pmResponse.ok) {
        const body = await pmResponse.text();
        console.error("PdfMonkey API failed:", pmResponse.status, body);
        // Document gone from PdfMonkey -> auto-regenerate the convention
        if (pmResponse.status === 404 || pmResponse.status === 410) {
          console.log("Document missing on PdfMonkey, auto-regenerating convention...");
          const regenBody: Record<string, unknown> = {
            trainingId: trainingForPath,
            subrogation: false,
          };
          if (participantId) regenBody.participantId = participantId;
          const { data: regenData, error: regenError } = await supabase.functions.invoke(
            "generate-convention-formation",
            { body: regenBody },
          );
          if (regenError || (regenData as any)?.error) {
            const msg = regenError?.message || (regenData as any)?.error || "Regeneration failed";
            console.error("Auto-regeneration failed:", msg);
            return json({ error: `Régénération automatique impossible: ${msg}` }, 500);
          }
          const newUrl = (regenData as any)?.pdfUrl as string | undefined;
          // Re-read updated row to get the freshly stored URL (may be permanent storage URL)
          const { data: refreshed } = await supabase
            .from(table)
            .select("convention_file_url")
            .eq("id", rowId)
            .single();
          const finalUrl = (refreshed as any)?.convention_file_url || newUrl;
          if (!finalUrl) return json({ error: "Régénération sans URL retournée" }, 500);
          return json({ pdf_url: finalUrl, refreshed: true, regenerated: true }, 200);
        }
        return json({ error: `PdfMonkey API indisponible (${pmResponse.status})` }, 500);
      }
      const pmData = await pmResponse.json();
      const freshUrl = pmData?.document?.download_url;
      if (!freshUrl) return json({ error: "Pas d'URL de téléchargement PdfMonkey" }, 500);

      pdfResponse = await fetch(freshUrl);
      if (!pdfResponse.ok) {
        await supabase.from(table).update({ convention_file_url: freshUrl }).eq("id", rowId);
        return json({ pdf_url: freshUrl, refreshed: true }, 200);
      }
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const storagePath = `conventions/${trainingForPath}/convention_${rowId}.pdf`;
    let permanentUrl: string | null = null;

    const { error: uploadErr } = await supabase.storage
      .from("training-documents")
      .upload(storagePath, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(storagePath);
      permanentUrl = publicUrl;
      await supabase.from(table).update({ convention_file_url: permanentUrl }).eq("id", rowId);
    }

    return json({ pdf_url: permanentUrl ?? currentUrl, refreshed: !!permanentUrl }, 200);
  } catch (error: unknown) {
    console.error("refresh-training-convention-url error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
