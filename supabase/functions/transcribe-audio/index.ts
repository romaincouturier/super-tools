import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    if (!LOVABLE_API_KEY) {
      return createErrorResponse("LOVABLE_API_KEY not configured", 500);
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return createErrorResponse("Le champ 'audio' est requis", 400);
    }

    // Convert audio to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await audioFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64Audio = btoa(binary);

    // Determine MIME type
    const mimeType = audioFile.type || "audio/webm";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un transcripteur audio. Transcris fidèlement le contenu audio en français. 
Retourne UNIQUEMENT le texte transcrit, sans ponctuation excessive, sans commentaires, sans guillemets. 
Si l'audio est inaudible ou vide, retourne exactement: [inaudible]`,
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: base64Audio,
                  format: mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "mp4" : "wav",
                },
              },
              {
                type: "text",
                text: "Transcris cet audio en français.",
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI transcription error:", response.status, errText);

      if (response.status === 429) {
        return createErrorResponse("Trop de requêtes, réessayez dans quelques secondes", 429);
      }
      if (response.status === 402) {
        return createErrorResponse("Crédits IA insuffisants", 402);
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const transcript = result.choices?.[0]?.message?.content?.trim() || "";

    return createJsonResponse({ transcript });
  } catch (error: unknown) {
    console.error("Error in transcribe-audio:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
