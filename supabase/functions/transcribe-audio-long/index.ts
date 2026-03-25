import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Transcribes long audio files (> 5 min) using AssemblyAI.
 * Accepts a JSON body with { audio_url: string } (public URL to the audio file).
 * AssemblyAI fetches the file directly — no base64 needed.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!ASSEMBLYAI_API_KEY) {
      return createErrorResponse("ASSEMBLYAI_API_KEY not configured", 500);
    }

    const { audio_url } = await req.json();
    if (!audio_url) {
      return createErrorResponse("audio_url is required", 400);
    }

    // Step 1: Submit transcription job
    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url,
        language_code: "fr",
        punctuate: true,
        format_text: true,
      }),
    });

    if (!submitResponse.ok) {
      const errText = await submitResponse.text();
      console.error("AssemblyAI submit error:", submitResponse.status, errText);
      if (submitResponse.status === 401) {
        return createErrorResponse("Clé API AssemblyAI invalide", 401);
      }
      throw new Error(`AssemblyAI submit error: ${submitResponse.status}`);
    }

    const { id: transcriptId } = await submitResponse.json();

    // Step 2: Poll until completion (max ~10 minutes)
    const MAX_POLLS = 120; // 120 * 5s = 10 min
    const POLL_INTERVAL = 5000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      const pollResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { Authorization: ASSEMBLYAI_API_KEY },
        }
      );

      if (!pollResponse.ok) {
        const errText = await pollResponse.text();
        console.error("AssemblyAI poll error:", pollResponse.status, errText);
        throw new Error(`AssemblyAI poll error: ${pollResponse.status}`);
      }

      const result = await pollResponse.json();

      if (result.status === "completed") {
        return createJsonResponse({ transcript: result.text });
      }

      if (result.status === "error") {
        console.error("AssemblyAI transcription error:", result.error);
        return createErrorResponse(
          `Erreur de transcription : ${result.error}`,
          500
        );
      }

      // status is "queued" or "processing" — keep polling
    }

    return createErrorResponse("Transcription timeout — fichier trop long", 504);
  } catch (error: unknown) {
    console.error("Error in transcribe-audio-long:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
