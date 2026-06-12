import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Transcribes long audio files via AssemblyAI.
 *
 * Two modes (to avoid edge function wall-time limits):
 *  - submit  : { audio_url } or { audio_base64, content_type? }
 *              -> { transcript_id }
 *  - poll    : { transcript_id }
 *              -> { status, transcript? }   status in: queued|processing|completed|error
 *
 * Legacy mode (no `mode` field): submits + polls until complete. Kept for
 * back-compat with short audios; new clients should use submit + poll.
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

    const body = await req.json();
    const mode: "submit" | "poll" | undefined = body?.mode;

    // ── POLL mode ──────────────────────────────────────────────────────
    if (mode === "poll") {
      const transcriptId: string | undefined = body?.transcript_id;
      if (!transcriptId) return createErrorResponse("transcript_id is required", 400);

      const pollResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { Authorization: ASSEMBLYAI_API_KEY } },
      );

      if (!pollResponse.ok) {
        const errText = await pollResponse.text();
        console.error("AssemblyAI poll error:", pollResponse.status, errText);
        return createErrorResponse(`AssemblyAI poll error: ${pollResponse.status}`, 500);
      }

      const result = await pollResponse.json();

      if (result.status === "completed") {
        let transcript = result.text;
        if (result.utterances && result.utterances.length > 0) {
          const uniqueSpeakers = new Set(
            result.utterances.map((u: { speaker: string }) => u.speaker),
          );
          if (uniqueSpeakers.size > 1) {
            transcript = result.utterances
              .map((u: { speaker: string; text: string }) => `Speaker ${u.speaker}: ${u.text}`)
              .join("\n\n");
          } else {
            transcript = result.utterances
              .map((u: { text: string }) => u.text)
              .join(" ");
          }
        }
        return createJsonResponse({ status: "completed", transcript });
      }

      if (result.status === "error") {
        const errStr = String(result.error || "");
        if (/no spoken audio|language_detection cannot be performed/i.test(errStr)) {
          return createJsonResponse({
            status: "completed",
            transcript: "",
            warning: "Aucune parole détectée dans l'enregistrement.",
          });
        }
        return createJsonResponse({ status: "error", error: errStr });
      }

      return createJsonResponse({ status: result.status });
    }

    // ── SUBMIT (or legacy) ─────────────────────────────────────────────
    const { audio_url, audio_base64, content_type } = body;
    let audioUrl = audio_url;

    if (!audioUrl && audio_base64) {
      const binary = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0));
      const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: {
          Authorization: ASSEMBLYAI_API_KEY,
          "Content-Type": content_type || "application/octet-stream",
        },
        body: binary,
      });
      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        console.error("AssemblyAI upload error:", uploadResponse.status, errText);
        throw new Error(`AssemblyAI upload error: ${uploadResponse.status}`);
      }
      const uploadData = await uploadResponse.json();
      audioUrl = uploadData.upload_url;
    }

    if (!audioUrl) {
      return createErrorResponse("audio_url or audio_base64 is required", 400);
    }

    const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true,
        language_confidence_threshold: 0.3,
        punctuate: true,
        format_text: true,
        speaker_labels: true,
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

    if (mode === "submit") {
      return createJsonResponse({ transcript_id: transcriptId });
    }

    // Legacy: poll until completion (short audios only).
    const MAX_POLLS = 24; // 24 * 5s = 2 min, stays under wall-time
    const POLL_INTERVAL = 5000;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      const pr = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { Authorization: ASSEMBLYAI_API_KEY } },
      );
      if (!pr.ok) throw new Error(`AssemblyAI poll error: ${pr.status}`);
      const r = await pr.json();
      if (r.status === "completed") {
        let transcript = r.text;
        if (r.utterances && r.utterances.length > 0) {
          transcript = r.utterances.map((u: { text: string }) => u.text).join(" ");
        }
        return createJsonResponse({ transcript });
      }
      if (r.status === "error") {
        return createErrorResponse(`Erreur de transcription : ${r.error}`, 500);
      }
    }

    // Return transcript_id so client can keep polling.
    return createJsonResponse({ transcript_id: transcriptId, status: "processing" });
  } catch (error: unknown) {
    console.error("Error in transcribe-audio-long:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
