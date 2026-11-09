/**
 * Mention discrète sur l'enregistrement des lives, ajoutée en fin des emails
 * d'accès et de rappel de live (et sur la page formation-info) pour les
 * formations qui ont des lives. Texte éditable : modèle `live_recording_notice`.
 */
import { renderCatalogEmail } from "./editable-email.ts";

// deno-lint-ignore no-explicit-any
export async function trainingHasLives(db: any, trainingId: string | null | undefined): Promise<boolean> {
  if (!trainingId) return false;
  const { count } = await db
    .from("training_live_meetings")
    .select("id", { count: "exact", head: true })
    .eq("training_id", trainingId)
    .neq("status", "cancelled");
  return (count ?? 0) > 0;
}

export function liveNoticeHtml(innerHtml: string): string {
  const text = innerHtml.replace(/<\/?p[^>]*>/g, " ").trim();
  if (!text) return "";
  return `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">${text}</p>`;
}

/** HTML prêt à insérer (petit texte gris), ou "" en cas d'erreur. */
// deno-lint-ignore no-explicit-any
export async function renderLiveRecordingNotice(db: any, formal: boolean | null | undefined): Promise<string> {
  try {
    const r = await renderCatalogEmail(db, "live_recording_notice", { formal: formal === false ? false : true });
    return liveNoticeHtml(r.html);
  } catch (e) {
    console.warn("[live-recording-notice] render failed", e);
    return "";
  }
}
