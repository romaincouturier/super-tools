/**
 * Résolution de la durée officielle d'une formation pour les attestations.
 *
 * Le calcul par défaut s'appuie sur `training_schedules` (3,5 h par demi-journée,
 * 7 h par journée). Les sessions e-learning / distanciel asynchrone n'ont aucun
 * créneau : la durée retombait alors à 0 h sur l'attestation.
 *
 * Ordre de repli quand le planning ne donne rien :
 *   1. durée de la formule achetée par le participant (`formation_formulas.duree_heures`)
 *   2. durée de l'entrée catalogue de la formation (`formation_configs.duree_heures`)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/** Durée (en heures) issue des créneaux planifiés. 0 si aucun créneau. */
export async function computeScheduledHours(supabase: Client, trainingId: string): Promise<number> {
  const { data: schedules } = await supabase
    .from("training_schedules")
    .select("day_date, start_time, end_time")
    .eq("training_id", trainingId);

  let totalHours = 0;
  for (const s of schedules ?? []) {
    const [startH, startM] = String(s.start_time).split(":").map(Number);
    const [endH, endM] = String(s.end_time).split(":").map(Number);
    const sessionMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    totalHours += sessionMinutes <= 240 ? 3.5 : 7;
  }
  return totalHours;
}

/**
 * Durée à imprimer sur l'attestation, en heures.
 * `participantId` ou `participantEmail` permet de retrouver la formule achetée.
 */
export async function resolveCertificateHours(
  supabase: Client,
  trainingId: string,
  opts: { participantId?: string | null; participantEmail?: string | null } = {},
): Promise<number> {
  const scheduled = await computeScheduledHours(supabase, trainingId);
  if (scheduled > 0) return scheduled;

  // 1. Formule du participant
  let participant: { formula_id: string | null } | null = null;
  if (opts.participantId) {
    const { data } = await supabase
      .from("training_participants")
      .select("formula_id")
      .eq("id", opts.participantId)
      .maybeSingle();
    participant = data ?? null;
  }
  if (!participant && opts.participantEmail) {
    const { data } = await supabase
      .from("training_participants")
      .select("formula_id")
      .eq("training_id", trainingId)
      .ilike("email", opts.participantEmail)
      .maybeSingle();
    participant = data ?? null;
  }

  if (participant?.formula_id) {
    const { data: formula } = await supabase
      .from("formation_formulas")
      .select("duree_heures")
      .eq("id", participant.formula_id)
      .maybeSingle();
    const hours = Number(formula?.duree_heures ?? 0);
    if (hours > 0) return hours;
  }

  // 2. Entrée catalogue de la formation
  const { data: training } = await supabase
    .from("trainings")
    .select("catalog_id")
    .eq("id", trainingId)
    .maybeSingle();

  if (training?.catalog_id) {
    const { data: config } = await supabase
      .from("formation_configs")
      .select("duree_heures")
      .eq("id", training.catalog_id)
      .maybeSingle();
    const hours = Number(config?.duree_heures ?? 0);
    if (hours > 0) return hours;
  }

  return 0;
}

/** Formate "25h en e-learning" (sans décimale inutile). */
export function formatDurationLabel(hours: number, formatFormation: string | null | undefined): string {
  const label = formatFormation === "classe_virtuelle"
    ? "classe virtuelle"
    : formatFormation === "e_learning"
      ? "e-learning"
      : "présentiel";
  const rounded = Number.isInteger(hours) ? String(hours) : String(hours);
  return `${rounded}h en ${label}`;
}
