/**
 * Registre des signalements de violences, harcèlement et discriminations.
 *
 * Le décret 2026-728 étend l'indicateur 12 : « Il s'assure de la prévention et
 * du traitement de toute situation de violence, dont les violences sexistes et
 * sexuelles, de harcèlement ou de discrimination dans le cadre de leur
 * formation. » Les valeurs ci-dessous reprennent les catégories nommées par le
 * texte, sans en inventer d'autres.
 */

export const VHD_CATEGORIES = [
  { value: "violence", label: "Violence" },
  { value: "violence_sexiste_sexuelle", label: "Violence sexiste ou sexuelle" },
  { value: "harcelement", label: "Harcèlement" },
  { value: "discrimination", label: "Discrimination" },
  { value: "autre", label: "Autre / non qualifié" },
] as const;

export const VHD_CHANNELS = [
  { value: "mail", label: "Email" },
  { value: "telephone", label: "Téléphone" },
  { value: "oral", label: "Oral" },
  { value: "formulaire", label: "Formulaire" },
  { value: "autre", label: "Autre" },
] as const;

/** Le traitement suit ces quatre états, du signalement à la clôture. */
export const VHD_STATUSES = [
  { value: "recu", label: "Reçu", tone: "alert" },
  { value: "en_analyse", label: "En cours d'analyse", tone: "alert" },
  { value: "mesures_prises", label: "Mesures prises", tone: "progress" },
  { value: "cloture", label: "Clôturé", tone: "done" },
] as const;

export type VhdStatus = (typeof VHD_STATUSES)[number]["value"];

export const VHD_PROCEDURE_STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "active", label: "En vigueur" },
  { value: "archived", label: "Archivée" },
] as const;

function labelFrom(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
): string {
  return list.find((entry) => entry.value === value)?.label ?? "—";
}

export const categoryLabel = (v: string | null | undefined) => labelFrom(VHD_CATEGORIES, v);
export const channelLabel = (v: string | null | undefined) => labelFrom(VHD_CHANNELS, v);
export const statusLabel = (v: string | null | undefined) => labelFrom(VHD_STATUSES, v);

/** Un signalement encore ouvert dont l'échéance de traitement est dépassée. */
export function isOverdue(
  report: { status: string; due_date: string | null },
  today: string,
): boolean {
  if (report.status === "cloture") return false;
  if (!report.due_date) return false;
  return report.due_date < today;
}

/** Délai de traitement en jours, borne haute non close comprise. */
export function handlingDays(
  report: { reported_at: string; closed_at: string | null },
  today: string,
): number {
  const start = new Date(report.reported_at).getTime();
  const end = new Date(report.closed_at ?? today).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/**
 * Répartition par statut, pour montrer d'un coup d'œil ce qui reste ouvert.
 * Un statut inconnu est compté à part plutôt qu'ignoré : une ligne qui
 * disparaît d'un registre réglementaire est pire qu'une ligne mal rangée.
 */
export function countByStatus(
  reports: ReadonlyArray<{ status: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { value } of VHD_STATUSES) counts[value] = 0;
  for (const report of reports) {
    counts[report.status] = (counts[report.status] ?? 0) + 1;
  }
  return counts;
}

/** Champs du formulaire de signalement, tels que saisis à l'écran. */
export interface VhdReportFormValues {
  reported_at: string;
  training_id: string;
  channel: string;
  category: string;
  handled_by: string;
  actions_taken: string;
  due_date: string;
  status: string;
}

export interface VhdReportRecord {
  reported_at: string;
  training_id: string | null;
  channel: string;
  category: string;
  handled_by: string | null;
  actions_taken: string | null;
  due_date: string | null;
  status: string;
  closed_at: string | null;
}

/**
 * Enregistrement à écrire en base à partir du formulaire.
 *
 * La date de clôture suit le statut et ne se saisit jamais à la main : un
 * signalement rouvert perd sa date de clôture, sinon le registre affirmerait
 * qu'une affaire close est encore en cours de traitement.
 */
export function buildReportRecord(
  form: VhdReportFormValues,
  now: string,
  today: string,
): VhdReportRecord {
  const trimmed = (value: string) => value.trim() || null;
  return {
    reported_at: form.reported_at || today,
    training_id: form.training_id || null,
    channel: form.channel,
    category: form.category,
    handled_by: trimmed(form.handled_by),
    actions_taken: trimmed(form.actions_taken),
    due_date: form.due_date || null,
    status: form.status,
    closed_at: form.status === "cloture" ? now : null,
  };
}
