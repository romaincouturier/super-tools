import { EDITABLE_EMAIL_DEFAULTS } from "../../supabase/functions/_shared/editable-email-defaults";

/** Texte de la mention d'enregistrement des lives : modèle édité, sinon texte par défaut tu/vous. */
export function liveRecordingNoticeText(custom: string | null | undefined, formal: boolean | null | undefined): string {
  const cleaned = (custom ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned;
  return EDITABLE_EMAIL_DEFAULTS.live_recording_notice.content[formal === false ? "tu" : "vous"];
}
