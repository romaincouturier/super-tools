import { addWorkingDays, subtractWorkingDays, fetchWorkingDays } from "./working-days.ts";

/**
 * Relances du recueil des besoins, quel que soit le chemin d'ajout du participant :
 * - relance 1 : `reminderDelay` jours ouvrés après l'envoi du questionnaire ;
 * - relance 2 : la veille ouvrée de la formation, à 9 h.
 * Chaque relance est envoyée seulement si le questionnaire n'est pas rempli
 * (contrôle fait au moment de l'envoi). Les dates passées, postérieures au
 * début de la formation ou déjà programmées sont ignorées.
 */
export function planNeedsSurveyReminderDays(params: {
  sentAt: Date;
  sessionStart: string | null;
  reminderDelay: number;
  workingDays?: boolean[];
}): string[] {
  const { sentAt, sessionStart, reminderDelay, workingDays } = params;
  const day = (d: Date) => d.toISOString().split("T")[0];
  const sentDay = day(sentAt);
  const days: string[] = [];
  const first = day(addWorkingDays(sentAt, reminderDelay, workingDays));
  if (!sessionStart || first < sessionStart) days.push(first);
  if (sessionStart) {
    const eve = day(subtractWorkingDays(new Date(`${sessionStart}T00:00:00Z`), 1, workingDays));
    if (eve > sentDay && !days.includes(eve)) days.push(eve);
  }
  return days.filter((d) => d > sentDay);
}

// deno-lint-ignore no-explicit-any
export async function scheduleNeedsSurveyReminders(supabase: any, params: {
  trainingId: string;
  participantId: string;
  sessionStart: string | null;
  sentAt?: Date;
}): Promise<void> {
  try {
    const { data: setting } = await supabase
      .from("app_settings").select("setting_value")
      .eq("setting_key", "delay_needs_survey_reminder_days").maybeSingle();
    const reminderDelay = parseInt(setting?.setting_value || "", 10) || 3;
    const workingDays = await fetchWorkingDays(supabase);
    const planned = planNeedsSurveyReminderDays({
      sentAt: params.sentAt ?? new Date(),
      sessionStart: params.sessionStart,
      reminderDelay,
      workingDays,
    });
    if (planned.length === 0) return;
    const { data: existing } = await supabase
      .from("scheduled_emails").select("scheduled_for")
      .eq("participant_id", params.participantId)
      .eq("training_id", params.trainingId)
      .eq("email_type", "needs_survey_reminder")
      .in("status", ["pending", "sent"]);
    const taken = new Set((existing ?? []).map((r: { scheduled_for: string }) => String(r.scheduled_for).slice(0, 10)));
    const rows = planned.filter((d) => !taken.has(d)).map((d) => ({
      training_id: params.trainingId,
      participant_id: params.participantId,
      email_type: "needs_survey_reminder",
      scheduled_for: `${d}T09:00:00`,
      status: "pending",
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from("scheduled_emails").insert(rows);
    if (error && error.code !== "23505") console.error("[needs-survey-reminders] insert:", error);
  } catch (err) {
    console.error("[needs-survey-reminders] schedule:", err);
  }
}
