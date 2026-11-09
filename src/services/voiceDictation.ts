import { supabase } from "@/integrations/supabase/client";

export interface DictationContext {
  entity: "crm_card" | "event";
  entityId: string;
  title: string;
}

type Invoke = (body: Record<string, unknown>) => Promise<Record<string, any>>;

export async function waitForDictation(
  audioBase64: string,
  contentType: string,
  invoke: Invoke,
  onSubmitted?: (id: string) => Promise<void>,
  pause = () => new Promise<void>((resolve) => setTimeout(resolve, 3000)),
) {
  const submitted = await invoke({ mode: "submit", audio_base64: audioBase64, content_type: contentType });
  const id = submitted.transcript_id;
  if (typeof id !== "string" || !id) throw new Error("La transcription n’a pas été acceptée");
  await onSubmitted?.(id);
  for (let i = 0; i < 600; i++) {
    await pause();
    const result = await invoke({ mode: "poll", transcript_id: id });
    if (result.status === "error") throw new Error(String(result.error || "Erreur de transcription"));
    if (result.status === "completed") {
      if (typeof result.transcript !== "string" || !result.transcript.trim() || result.transcript === "[inaudible]") {
        throw new Error("Aucune parole détectée dans l’enregistrement");
      }
      return { text: result.transcript, duration: result.audio_duration ?? null };
    }
  }
  throw new Error("La transcription est toujours en cours ; l’audio et son identifiant sont conservés");
}

export async function transcribeDictation(blob: Blob, context?: DictationContext) {
  const db = supabase as any;
  let recordId: string | undefined;
  let metadata: Record<string, unknown> = {};
  try {
    if (context) {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Connexion requise pour enregistrer la dictée");
      metadata = { entity: context.entity, entity_id: context.entityId, created_by: auth.user.id };
      const { data, error } = await db.from("transcripts").insert({
        source: "dictation", external_id: crypto.randomUUID(), title: context.title,
        status: "pending", tags: [], metadata,
      }).select("id").single();
      if (error) throw error;
      recordId = data.id;
      const table = context.entity === "crm_card" ? "crm_card_transcripts" : "event_transcripts";
      const fk = context.entity === "crm_card" ? "card_id" : "event_id";
      const { error: linkError } = await db.from(table).upsert({
        [fk]: context.entityId, transcript_id: recordId, created_by: auth.user.id,
      }, { onConflict: `${fk},transcript_id`, ignoreDuplicates: true });
      if (linkError) throw linkError;
      const form = new FormData();
      form.append("transcriptId", recordId ?? "");
      form.append("file", new File([blob], "dictee.webm", { type: blob.type }));
      const { data: uploaded, error: uploadError } = await supabase.functions.invoke("upload-meeting-recording", { body: form });
      if (uploadError) throw uploadError;
      if (!uploaded?.path) throw new Error("L’audio n’a pas été sauvegardé");
      metadata = uploaded.metadata;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error || new Error("Lecture audio impossible"));
      reader.readAsDataURL(blob);
    });
    const result = await waitForDictation(base64, blob.type, async (body) => {
      const { data, error } = await supabase.functions.invoke("transcribe-audio-long", { body });
      if (error) throw error;
      if (data?.error && !data.status) throw new Error(String(data.error));
      return data;
    }, async (id) => {
      if (!recordId) return;
      const { error } = await db.from("transcripts").update({ assemblyai_id: id, status: "processing" }).eq("id", recordId);
      if (error) throw error;
    });
    if (recordId) {
      const { error } = await db.from("transcripts").update({ raw_text: result.text, duration_seconds: result.duration, status: "ready", error_message: null }).eq("id", recordId);
      if (error) throw error;
    }
    return result.text;
  } catch (error) {
    if (recordId) {
      const { error: logError } = await db.from("transcripts").update({ status: "error", error_message: error instanceof Error ? error.message : String(error), metadata }).eq("id", recordId);
      if (logError) console.error("Enregistrement de l’échec de dictée impossible", logError);
    }
    throw error;
  }
}