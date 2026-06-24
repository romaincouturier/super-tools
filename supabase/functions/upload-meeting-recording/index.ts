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
      if (!missionId || !UUID.test(missionId)) throw new Error("Mission invalide");
      return { missionId };
    },
    buildPath: ({ missionId }, file) => {
      const ext = (file.type || "").includes("mp4") ? "mp4" : "webm";
      return `${missionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    },
    persist: async (admin, _params, _fileUrl, filePath) => {
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
