import { handleFileUpload } from "../_shared/upload-handler.ts";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Receives an in-browser meeting recording (mic + system audio), stores it in
 * the private `meeting-recordings` bucket and returns a short-lived signed URL
 * the client passes to `transcribe-audio-long`. No DB row: the file is a
 * transient transcription input the client deletes once transcribed.
 */
Deno.serve((req) =>
  handleFileUpload(req, {
    name: "upload-meeting-recording",
    bucket: "meeting-recordings",
    validateParams: (form) => {
      const missionId = String(form.get("missionId") || "");
      const transcriptId = String(form.get("transcriptId") || "");
      if (transcriptId && UUID.test(transcriptId)) return { missionId: "", transcriptId };
      if (!missionId || !UUID.test(missionId)) throw new Error("Mission invalide");
      return { missionId, transcriptId: "" };
    },
    authorize: async (admin, userId, { transcriptId }) => {
      const { isStaffUser } = await import("../_shared/cron-auth.ts");
      if (!await isStaffUser(admin, userId)) return false;
      if (!transcriptId) return true;
      const { data, error } = await admin.from("transcripts").select("source,metadata").eq("id", transcriptId).maybeSingle();
      return !error && data?.source === "dictation" && data.metadata?.created_by === userId;
    },
    buildPath: ({ missionId, transcriptId }, file) => {
      const ext = (file.type || "").includes("mp4") ? "mp4" : "webm";
      return `${transcriptId ? `dictation/${transcriptId}` : missionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    },
    persist: async (admin, { transcriptId }, _fileUrl, filePath, file) => {
      if (transcriptId) {
        const { data, error } = await admin.from("transcripts").select("metadata").eq("id", transcriptId).single();
        if (error) throw error;
        const metadata = { ...data.metadata, audio_bucket: "meeting-recordings", audio_path: filePath, audio_bytes: file.size };
        const { error: saveError } = await admin.from("transcripts").update({ metadata }).eq("id", transcriptId);
        if (saveError) throw saveError;
        return { path: filePath, metadata };
      }
      const { data, error } = await admin.storage
        .from("meeting-recordings")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "URL signée indisponible");
      }
      return { signed_url: data.signedUrl, path: filePath };
    },
  })
);
