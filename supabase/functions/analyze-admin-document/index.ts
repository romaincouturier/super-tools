import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

const CATEGORIES = [
  "Facture",
  "Contrat",
  "RH / Paie",
  "Fiscal",
  "Bancaire",
  "Assurance",
  "Légal",
  "Formation",
  "Commercial",
  "Divers",
];

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la classification de documents administratifs français.
Analyse le document fourni et extrais les informations suivantes en JSON :
- year : l'année principale du document (entier, ex: 2024). Cherche la date du document, l'exercice fiscal, la période concernée. Si introuvable, null.
- category : la catégorie parmi cette liste EXACTE : ${CATEGORIES.join(", ")}
- tags : tableau de 3 à 6 mots-clés précis et utiles pour retrouver ce document (noms propres, montants clés, type exact, organisme émetteur, etc.)
- summary : une phrase courte (max 15 mots) décrivant l'essentiel du document

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication.
Exemple : {"year":2024,"category":"Facture","tags":["EDF","électricité","1250€","janvier"],"summary":"Facture EDF électricité 1 250 € janvier 2024"}`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const supabase = getSupabaseClient();

  try {
    const { documentId, filePath, mimeType, fileName } = await req.json();

    if (!documentId || !filePath) {
      return new Response(
        JSON.stringify({ error: "documentId and filePath are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Download file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("admin-archives")
      .download(filePath);

    if (downloadErr || !fileData) {
      throw new Error(`Storage download failed: ${downloadErr?.message}`);
    }

    // Build Claude message content
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const base64 = btoa(binary);

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

    const content: ContentBlock[] = [];

    const isPdf = mimeType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");
    const isImage = mimeType?.startsWith("image/");

    if (isPdf) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    } else if (isImage) {
      const imageType = (mimeType && ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType))
        ? mimeType
        : "image/jpeg";
      content.push({
        type: "image",
        source: { type: "base64", media_type: imageType, data: base64 },
      });
    } else {
      // For non-PDF/image files, classify by filename + mime type alone
      content.push({
        type: "text",
        text: `Nom du fichier : ${fileName}\nType MIME : ${mimeType ?? "inconnu"}\n\nClass ce document même sans en voir le contenu.`,
      });
    }

    content.push({
      type: "text",
      text: "Analyse et classe ce document.",
    });

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(isPdf ? { "anthropic-beta": "pdfs-2024-09-25" } : {}),
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API error ${claudeRes.status}: ${errText}`);
    }

    const claudeJson = await claudeRes.json();
    const rawText = claudeJson.content?.[0]?.text ?? "{}";

    let analysis: { year?: number | null; category?: string; tags?: string[]; summary?: string } = {};
    try {
      analysis = JSON.parse(rawText);
    } catch {
      console.error("[analyze-admin-document] Failed to parse Claude response:", rawText);
    }

    // Validate category
    const category = CATEGORIES.includes(analysis.category ?? "") ? analysis.category : "Divers";

    await supabase
      .from("admin_documents")
      .update({
        year: analysis.year ?? null,
        category,
        tags: Array.isArray(analysis.tags) ? analysis.tags : [],
        summary: analysis.summary ?? null,
        analysis_status: "done",
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, year: analysis.year, category, tags: analysis.tags, summary: analysis.summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[analyze-admin-document] error:", err);

    // Mark analysis as failed if we have a documentId
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.documentId) {
        await supabase
          .from("admin_documents")
          .update({ analysis_status: "failed" })
          .eq("id", body.documentId);
      }
    } catch { /* best-effort */ }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
