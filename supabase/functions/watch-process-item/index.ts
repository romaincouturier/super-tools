import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";
import { getOpenAIApiKey } from "../_shared/api-keys.ts";

/**
 * Process a newly added watch item:
 * 1. If URL → scrape content
 * 2. If image → OCR text extraction
 * 3. If audio → transcription via AssemblyAI
 * 4. Auto-generate title & tags via OpenAI
 * 5. Generate embedding for similarity/clustering
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { item_id } = await req.json();
    if (!item_id) return createErrorResponse("item_id is required", 400);

    const supabase = getSupabaseClient();

    const saveUpdates = async (patch: Record<string, unknown>) => {
      if (Object.keys(patch).length === 0) return;

      const { error } = await supabase
        .from("watch_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", item_id);

      if (error) {
        throw new Error(`Failed to update watch item ${item_id}: ${error.message}`);
      }
    };

    // Fetch the item
    const { data: item, error: fetchError } = await supabase
      .from("watch_items")
      .select("*")
      .eq("id", item_id)
      .single();

    if (fetchError || !item) {
      return createErrorResponse("Item not found", 404);
    }

    let body = item.body || "";
    const updates: Record<string, unknown> = {};

    // ── Step 1: Content extraction ──────────────────────────────────

    if (item.content_type === "url" && item.source_url) {
      // Scrape URL content
      try {
        const scrapeRes = await fetch(item.source_url, {
          headers: { "User-Agent": "SuperTools-Watch/1.0" },
          redirect: "follow",
        });
        if (scrapeRes.ok) {
          const html = await scrapeRes.text();
          // Basic HTML-to-text extraction
          body = extractTextFromHtml(html);
          updates.body = body.slice(0, 10000); // Limit body size
        }
      } catch (e) {
        console.warn("URL scraping failed:", e);
      }
    }

    if (item.content_type === "image" && item.file_url) {
      // OCR via OpenAI Vision
      const OPENAI_API_KEY = await getOpenAIApiKey();
      if (!OPENAI_API_KEY) {
        console.error("OCR skipped: OPENAI_API_KEY is not configured");
      } else {
        try {
          const ocrRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all text from this image. Return only the extracted text, nothing else. If no text is found, return an empty string." },
                    { type: "image_url", image_url: { url: item.file_url, detail: "high" } },
                  ],
                },
              ],
              max_tokens: 2000,
            }),
          });

          if (ocrRes.ok) {
            const ocrData = await ocrRes.json();
            const extractedText = ocrData.choices?.[0]?.message?.content || "";
            if (extractedText.trim()) {
              // Store OCR in transcript field — never overwrite user notes in body
              updates.transcript = extractedText;
              console.log(`OCR extracted ${extractedText.length} chars from image → transcript`);
              await saveUpdates({ transcript: extractedText });
              // Use extracted text for AI title/tags generation if body is empty
              if (!body) {
                body = extractedText;
              }
            }
          } else {
            const errText = await ocrRes.text();
            console.error(`OCR API error ${ocrRes.status}:`, errText);
          }
        } catch (e) {
          console.error("OCR failed:", e);
        }
      }
    }

    if (item.content_type === "audio" && item.file_url) {
      // Transcription via AssemblyAI
      const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
      if (ASSEMBLYAI_API_KEY) {
        try {
          // Submit transcription job
          const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
              Authorization: ASSEMBLYAI_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              audio_url: item.file_url,
              language_code: "fr",
              punctuate: true,
              format_text: true,
            }),
          });

          if (submitRes.ok) {
            const { id: transcriptId } = await submitRes.json();

            // Poll for completion (max 5 min)
            for (let i = 0; i < 60; i++) {
              await new Promise((r) => setTimeout(r, 5000));

              const pollRes = await fetch(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { Authorization: ASSEMBLYAI_API_KEY } }
              );

              if (pollRes.ok) {
                const result = await pollRes.json();
                if (result.status === "completed") {
                  body = result.text || "";
                  updates.body = body;
                  if (body.trim()) {
                    await saveUpdates({ body });
                  }
                  break;
                }
                if (result.status === "error") break;
              }
            }
          }
        } catch (e) {
          console.warn("Audio transcription failed:", e);
        }
      }
    }

    // ── Step 2: AI title & tags ─────────────────────────────────────

    const OPENAI_API_KEY_FOR_AI = await getOpenAIApiKey();
    if (OPENAI_API_KEY_FOR_AI && body) {
      try {
        const textForAI = body.slice(0, 3000);
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY_FOR_AI}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Tu es un assistant de veille technologique. Analyse le contenu suivant et retourne un JSON avec:
- "title": un titre court et descriptif (max 80 caractères)
- "tags": un tableau de 2 à 5 tags pertinents en minuscules (ex: ["ia", "react", "devops"])

Retourne UNIQUEMENT le JSON, sans markdown ni explication.`,
              },
              { role: "user", content: textForAI },
            ],
            max_tokens: 200,
            temperature: 0.3,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const aiContent = aiData.choices?.[0]?.message?.content || "";
          try {
            const parsed = JSON.parse(aiContent);
            const enrichmentUpdates: Record<string, unknown> = {};
            if (parsed.title && (!item.title || item.title === "(Sans titre)")) {
              updates.title = parsed.title;
              enrichmentUpdates.title = parsed.title;
            }
            if (parsed.tags?.length && (!item.tags || item.tags.length === 0)) {
              updates.tags = parsed.tags;
              enrichmentUpdates.tags = parsed.tags;
            }
            await saveUpdates(enrichmentUpdates);
          } catch {
            console.warn("Failed to parse AI response:", aiContent);
          }
        }
      } catch (e) {
        console.warn("AI title/tags failed:", e);
      }

      // ── Step 3: Generate embedding ──────────────────────────────

      try {
        const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY_FOR_AI}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: body.slice(0, 8000),
          }),
        });

        if (embeddingRes.ok) {
          const embData = await embeddingRes.json();
          const embedding = embData.data?.[0]?.embedding;
          if (embedding) {
            updates.embedding = JSON.stringify(embedding);
            await saveUpdates({ embedding: updates.embedding });
          }
        }
      } catch (e) {
        console.warn("Embedding generation failed:", e);
      }
    }

    // ── Step 4: Save updates ────────────────────────────────────────

    return createJsonResponse({ success: true, updates: Object.keys(updates) });
  } catch (error: unknown) {
    console.error("Error processing watch item:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});

/** Basic HTML text extraction */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
