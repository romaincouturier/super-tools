import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

type MissionDocument = {
  id: string;
  mission_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  processing_status: "pending" | "processing" | "completed" | "failed" | "none";
  processing_started_at: string | null;
  processing_estimated_seconds: number | null;
  assemblyai_transcript_id: string | null;
};

type AssemblyResult = {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  text?: string;
  error?: string;
  utterances?: Array<{ speaker: string; text: string }>;
};

const MAX_WALL_MS = 50_000;
const POLL_INTERVAL_MS = 5_000;
const DEFAULT_ESTIMATE_SECONDS = 180;

function estimateProcessingSeconds(fileSize: number | null): number {
  const sizeMb = Math.max(1, (fileSize || 0) / (1024 * 1024));
  return Math.min(900, Math.max(90, Math.round(35 + sizeMb * 8)));
}

function computeProgress(doc: MissionDocument, assemblyStatus: string): number {
  if (assemblyStatus === "queued") return Math.max(12, Number((doc as any).processing_progress || 0));
  const startedAt = doc.processing_started_at ? new Date(doc.processing_started_at).getTime() : Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - startedAt) / 1000);
  const estimate = doc.processing_estimated_seconds || estimateProcessingSeconds(doc.file_size) || DEFAULT_ESTIMATE_SECONDS;
  return Math.max(20, Math.min(92, Math.round((elapsedSeconds / estimate) * 88)));
}

function buildTranscript(result: AssemblyResult): string {
  let transcript = result.text || "";
  if (result.utterances && result.utterances.length > 0) {
    const uniqueSpeakers = new Set(result.utterances.map((u) => u.speaker));
    transcript = uniqueSpeakers.size > 1
      ? result.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n\n")
      : result.utterances.map((u) => u.text).join(" ");
  }
  return transcript.trim() || "[inaudible]";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function transcriptToHtml(transcript: string): string {
  return transcript
    .split(/\n\n+/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function fallbackTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Transcription audio";
}

async function generateTitle(transcript: string, fileName: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return fallbackTitle(fileName);

  try {
    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const response = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu génères des titres courts et descriptifs en français, sans guillemets ni ponctuation finale." },
          { role: "user", content: `Génère un titre de 5 à 10 mots pour cette transcription.\n\n${transcript.slice(0, 4000)}` },
        ],
      }),
    });
    if (!response.ok) throw new Error(`AI title error ${response.status}`);
    const data = await response.json();
    const title = String(data.choices?.[0]?.message?.content || "")
      .trim()
      .replace(/^["'«»]|["'«»]$/g, "")
      .replace(/[.!?]+$/g, "")
      .slice(0, 200);
    return title || fallbackTitle(fileName);
  } catch (error) {
    console.warn("[process-mission-audio-transcriptions] title generation failed", error);
    return fallbackTitle(fileName);
  }
}

async function submitAssemblyJob(apiKey: string, audioUrl: string): Promise<string> {
  const response = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      // Auto-detect spoken language instead of forcing French.
      language_detection: true,
      language_confidence_threshold: 0.5,
      punctuate: true,
      format_text: true,
      speaker_labels: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`AssemblyAI submit error ${response.status}: ${details}`);
  }

  const data = await response.json();
  if (!data.id) throw new Error("AssemblyAI did not return a transcript id");
  return data.id;
}

async function pollAssemblyJob(apiKey: string, transcriptId: string): Promise<AssemblyResult> {
  const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
    headers: { Authorization: apiKey },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`AssemblyAI poll error ${response.status}: ${details}`);
  }

  return await response.json();
}

async function completeDocument(supabase: ReturnType<typeof createClient>, doc: MissionDocument, transcript: string) {
  if (!transcript || transcript === "[inaudible]") {
    throw new Error("Transcription impossible — audio inaudible ou vide");
  }

  const { data: pages } = await supabase
    .from("mission_pages")
    .select("position")
    .eq("mission_id", doc.mission_id)
    .is("parent_page_id", null)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = ((pages?.[0] as { position?: number } | undefined)?.position ?? -1) + 1;
  const title = await generateTitle(transcript, doc.file_name);
  const htmlContent = transcriptToHtml(transcript);

  const { data: page, error: pageError } = await supabase
    .from("mission_pages")
    .insert({
      mission_id: doc.mission_id,
      title,
      content: htmlContent,
      icon: "🎙️",
      position: nextPosition,
    })
    .select("id")
    .single();

  if (pageError) throw pageError;

  const { error: updateError } = await supabase
    .from("mission_documents")
    .update({
      processing_status: "completed",
      processing_progress: 100,
      processing_completed_at: new Date().toISOString(),
      processing_updated_at: new Date().toISOString(),
      processing_error: null,
      transcript_page_id: page.id,
    })
    .eq("id", doc.id);

  if (updateError) throw updateError;
}

async function processDocument(supabase: ReturnType<typeof createClient>, apiKey: string, doc: MissionDocument, deadline: number) {
  let workingDoc = doc;

  if (!workingDoc.assemblyai_transcript_id) {
    const transcriptId = await submitAssemblyJob(apiKey, workingDoc.file_url);
    const startedAt = new Date().toISOString();
    const estimate = workingDoc.processing_estimated_seconds || estimateProcessingSeconds(workingDoc.file_size);

    const { error } = await supabase
      .from("mission_documents")
      .update({
        processing_status: "processing",
        processing_progress: 8,
        processing_started_at: startedAt,
        processing_updated_at: startedAt,
        processing_error: null,
        processing_estimated_seconds: estimate,
        assemblyai_transcript_id: transcriptId,
      })
      .eq("id", workingDoc.id);
    if (error) throw error;
    workingDoc = { ...workingDoc, assemblyai_transcript_id: transcriptId, processing_started_at: startedAt, processing_estimated_seconds: estimate, processing_status: "processing" };
  }

  while (Date.now() < deadline) {
    const result = await pollAssemblyJob(apiKey, workingDoc.assemblyai_transcript_id!);

    if (result.status === "completed") {
      await completeDocument(supabase, workingDoc, buildTranscript(result));
      return "completed";
    }

    if (result.status === "error") {
      throw new Error(result.error || "AssemblyAI transcription error");
    }

    await supabase
      .from("mission_documents")
      .update({
        processing_status: "processing",
        processing_progress: computeProgress(workingDoc, result.status),
        processing_updated_at: new Date().toISOString(),
      })
      .eq("id", workingDoc.id);

    if (Date.now() + POLL_INTERVAL_MS >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return "processing";
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const assemblyKey = Deno.env.get("ASSEMBLYAI_API_KEY");
  if (!supabaseUrl || !serviceKey || !assemblyKey) return createErrorResponse("Configuration serveur manquante", 500);

  try {
    const body = await req.json().catch(() => ({}));
    const documentId = typeof body.documentId === "string" ? body.documentId : null;
    const supabase = createClient(supabaseUrl, serviceKey);
    const deadline = Date.now() + MAX_WALL_MS;

    let query = supabase
      .from("mission_documents")
      .select("id, mission_id, file_name, file_url, file_size, mime_type, processing_status, processing_started_at, processing_estimated_seconds, assemblyai_transcript_id")
      .in("processing_status", ["pending", "processing"])
      .is("transcript_page_id", null)
      .order("processing_updated_at", { ascending: true, nullsFirst: true })
      .limit(documentId ? 1 : 3);

    if (documentId) query = query.eq("id", documentId);

    const { data: docs, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    let completed = 0;
    let stillProcessing = 0;
    let failed = 0;

    for (const doc of (docs || []) as MissionDocument[]) {
      try {
        const result = await processDocument(supabase, assemblyKey, doc, deadline);
        if (result === "completed") completed++;
        else stillProcessing++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        console.error("[process-mission-audio-transcriptions] document failed", doc.id, message);
        await supabase
          .from("mission_documents")
          .update({
            processing_status: "failed",
            processing_progress: 100,
            processing_error: message,
            processing_updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
      }

      if (Date.now() >= deadline) break;
    }

    return createJsonResponse({ processed: docs?.length || 0, completed, processing: stillProcessing, failed });
  } catch (error) {
    console.error("[process-mission-audio-transcriptions] unexpected error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
