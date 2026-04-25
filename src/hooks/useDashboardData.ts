import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { todayAsISO, dateAsISO } from "@/lib/dateFormatters";
import {
  buildKpis,
  formatEur,
  toHourMin,
  durationLabel,
  type DashboardKpi,
  type DashboardKpiSource,
  type DashboardKpiTrend,
} from "@/lib/dashboardHelpers";

// ── Types ────────────────────────────────────────────────────

export type KpiTrend = DashboardKpiTrend;
export type { DashboardKpi };

export type DashboardAgendaType =
  | "formation"
  | "evenement"
  | "opportunite"
  | "mission"
  | "activite"
  | "email"
  | "coaching";

export interface DashboardAgendaItem {
  time: string;
  dur: string;
  title: string;
  tag: string;
  type: DashboardAgendaType;
  accent: boolean;
  path: string;
}

export type DashboardAttentionIcon = "alert" | "file" | "clipboard" | "mail";
export interface DashboardAttentionItem {
  icon: DashboardAttentionIcon;
  text: string;
  path: string;
  tone: "warn" | "info";
}

export interface DashboardInsight {
  headline: string;
  detail: string;
  path: string;
}

// ── Query: KPIs ──────────────────────────────────────────────

async function fetchKpis(): Promise<DashboardKpiSource> {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(addDays(startOfMonth(now), -1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(addDays(startOfMonth(now), -1)), "yyyy-MM-dd");
  const today = todayAsISO();
  const sevenDaysFromNow = dateAsISO(addDays(now, 7));
  const sevenDaysAgo = dateAsISO(addDays(now, -7));

  const [wonThisMonth, wonLastMonth, missions, missionsNew, trainings, trainingsWeek, openQuotes] = await Promise.all([
    supabase
      .from("crm_cards")
      .select("estimated_value")
      .eq("sales_status", "WON")
      .gte("won_at", monthStart)
      .lte("won_at", `${monthEnd}T23:59:59Z`),
    supabase
      .from("crm_cards")
      .select("estimated_value")
      .eq("sales_status", "WON")
      .gte("won_at", lastMonthStart)
      .lte("won_at", `${lastMonthEnd}T23:59:59Z`),
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .in("status", ["not_started", "in_progress"]),
    supabase
      .from("missions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    supabase
      .from("trainings")
      .select("id", { count: "exact", head: true })
      .gte("start_date", today)
      .eq("is_cancelled", false),
    supabase
      .from("trainings")
      .select("id", { count: "exact", head: true })
      .gte("start_date", today)
      .lte("start_date", sevenDaysFromNow)
      .eq("is_cancelled", false),
    supabase
      .from("crm_cards")
      .select("id", { count: "exact", head: true })
      .eq("sales_status", "OPEN"),
  ]);

  const sumValue = (rows: { estimated_value: number | null }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r.estimated_value) || 0), 0);

  return {
    caSignedThisMonth: sumValue(wonThisMonth.data),
    caSignedLastMonth: sumValue(wonLastMonth.data),
    activeMissions: missions.count ?? 0,
    newMissionsThisWeek: missionsNew.count ?? 0,
    upcomingTrainings: trainings.count ?? 0,
    upcomingThisWeek: trainingsWeek.count ?? 0,
    openQuotes: openQuotes.count ?? 0,
  };
}

// ── Query: Agenda du jour ────────────────────────────────────

// Unwrap a Supabase relation that can come back as object OR array depending on FK direction.
function unwrap<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

// Extract HH:MM in the user's local timezone from a TIMESTAMPTZ string.
function tzHourMin(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function fetchAgenda(today: string, userId: string | null): Promise<DashboardAgendaItem[]> {
  if (!userId) return [];

  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  const [
    schedulesRes,
    eventsRes,
    crmCardsRes,
    missionsRes,
    missionActivitiesRes,
    trainingEmailsRes,
    crmEmailsRes,
    coachingBookingsRes,
  ] = await Promise.all([
    // Training sessions of the day (I'm the trainer)
    supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time, trainings!inner(id, training_name, assigned_to)")
      .eq("day_date", today)
      .eq("trainings.assigned_to", userId)
      .order("start_time", { ascending: true }),
    // Events of the day (I'm the owner)
    supabase
      .from("events")
      .select("id, event_date, event_time, title, location, assigned_to")
      .eq("event_date", today)
      .eq("assigned_to", userId)
      .order("event_time", { ascending: true }),
    // CRM next actions due today
    supabase
      .from("crm_cards")
      .select("id, title, waiting_next_action_text, waiting_next_action_date, status_operational, assigned_to")
      .eq("assigned_to", userId)
      .eq("waiting_next_action_date", today)
      .eq("status_operational", "WAITING"),
    // Missions starting / ending / with a next action today
    supabase
      .from("missions")
      .select("id, title, start_date, end_date, waiting_next_action_date, waiting_next_action_text, assigned_to")
      .eq("assigned_to", userId)
      .or(`start_date.eq.${today},end_date.eq.${today},waiting_next_action_date.eq.${today}`),
    // Mission activities logged today (on my missions)
    supabase
      .from("mission_activities")
      .select("id, description, activity_date, duration, duration_type, missions!inner(id, title, assigned_to)")
      .eq("activity_date", today)
      .eq("missions.assigned_to", userId),
    // Training scheduled emails going out today
    supabase
      .from("scheduled_emails")
      .select("id, email_type, scheduled_for, status, trainings!inner(id, training_name, assigned_to)")
      .eq("status", "pending")
      .gte("scheduled_for", todayStart)
      .lte("scheduled_for", todayEnd)
      .eq("trainings.assigned_to", userId),
    // CRM scheduled emails going out today
    (supabase as any)
      .from("crm_scheduled_emails")
      .select("id, subject, scheduled_at, status, crm_cards!inner(id, title, assigned_to)")
      .eq("status", "pending")
      .gte("scheduled_at", todayStart)
      .lte("scheduled_at", todayEnd)
      .eq("crm_cards.assigned_to", userId),
    // Coaching bookings today (on my trainings)
    supabase
      .from("coaching_bookings")
      .select("id, requested_date, duration_minutes, status, trainings!inner(id, training_name, assigned_to)")
      .gte("requested_date", todayStart)
      .lte("requested_date", todayEnd)
      .in("status", ["pending", "confirmed"])
      .eq("trainings.assigned_to", userId),
  ]);

  type ScheduleRow = {
    start_time: string | null;
    end_time: string | null;
    trainings: { id: string; training_name: string | null } | { id: string; training_name: string | null }[] | null;
  };
  type EventRow = { id: string; event_time: string | null; title: string | null; location: string | null };
  type CrmCardRow = { id: string; title: string | null; waiting_next_action_text: string | null };
  type MissionRow = {
    id: string;
    title: string | null;
    start_date: string | null;
    end_date: string | null;
    waiting_next_action_date: string | null;
    waiting_next_action_text: string | null;
  };
  type MissionActivityRow = {
    id: string;
    description: string | null;
    duration: number | null;
    duration_type: string | null;
    missions: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
  };
  type TrainingEmailRow = {
    id: string;
    email_type: string;
    scheduled_for: string;
    trainings: { id: string; training_name: string | null } | { id: string; training_name: string | null }[] | null;
  };
  type CrmEmailRow = {
    id: string;
    subject: string | null;
    scheduled_at: string;
    crm_cards: { id: string; title: string | null } | { id: string; title: string | null }[] | null;
  };
  type CoachingBookingRow = {
    id: string;
    requested_date: string;
    duration_minutes: number | null;
    trainings: { id: string; training_name: string | null } | { id: string; training_name: string | null }[] | null;
  };

  const fromSchedules: DashboardAgendaItem[] = ((schedulesRes.data ?? []) as ScheduleRow[]).map((row) => {
    const rel = unwrap(row.trainings);
    return {
      time: toHourMin(row.start_time),
      dur: durationLabel(row.start_time, row.end_time),
      title: `Formation — ${rel?.training_name ?? "Sans nom"}`,
      tag: "Formation",
      type: "formation",
      accent: true,
      path: rel?.id ? `/formation/${rel.id}` : "/formations",
    };
  });

  const fromEvents: DashboardAgendaItem[] = ((eventsRes.data ?? []) as EventRow[]).map((row) => ({
    time: toHourMin(row.event_time),
    dur: "",
    title: row.title || "Événement",
    tag: row.location || "Événement",
    type: "evenement",
    accent: false,
    path: `/events/${row.id}`,
  }));

  const fromCrmCards: DashboardAgendaItem[] = ((crmCardsRes.data ?? []) as CrmCardRow[]).map((row) => ({
    time: "",
    dur: "",
    title: row.waiting_next_action_text
      ? `${row.title ?? "Opportunité"} — ${row.waiting_next_action_text}`
      : row.title ?? "Opportunité",
    tag: "Opportunité",
    type: "opportunite",
    accent: false,
    path: `/crm?card=${row.id}`,
  }));

  const fromMissions: DashboardAgendaItem[] = ((missionsRes.data ?? []) as MissionRow[]).flatMap((row) => {
    const items: DashboardAgendaItem[] = [];
    const base = { time: "", dur: "", type: "mission" as const, accent: false, path: `/missions/${row.id}` };
    if (row.start_date === today) {
      items.push({ ...base, title: `Début de mission — ${row.title ?? "Sans titre"}`, tag: "Mission" });
    }
    if (row.end_date === today) {
      items.push({ ...base, title: `Fin de mission — ${row.title ?? "Sans titre"}`, tag: "Mission" });
    }
    if (row.waiting_next_action_date === today) {
      const action = row.waiting_next_action_text ?? "Prochaine action";
      items.push({
        ...base,
        title: `${row.title ?? "Mission"} — ${action}`,
        tag: "Mission",
      });
    }
    return items;
  });

  const fromMissionActivities: DashboardAgendaItem[] = ((missionActivitiesRes.data ?? []) as MissionActivityRow[]).map((row) => {
    const rel = unwrap(row.missions);
    const dur = row.duration
      ? `${row.duration} ${row.duration_type === "days" ? "j" : "h"}`
      : "";
    return {
      time: "",
      dur,
      title: `${rel?.title ?? "Mission"} — ${row.description ?? "Activité"}`,
      tag: "Activité",
      type: "activite",
      accent: false,
      path: rel?.id ? `/missions/${rel.id}` : "/missions",
    };
  });

  const emailTypeLabel = (code: string): string => {
    switch (code) {
      case "needs_survey": return "Questionnaire besoins";
      case "reminder_j7": return "Rappel J-7";
      case "needs_summary": return "Synthèse besoins";
      case "thank_you": return "Remerciement";
      case "relance": return "Relance";
      default: return "Email";
    }
  };

  const fromTrainingEmails: DashboardAgendaItem[] = ((trainingEmailsRes.data ?? []) as TrainingEmailRow[]).map((row) => {
    const rel = unwrap(row.trainings);
    return {
      time: tzHourMin(row.scheduled_for),
      dur: "",
      title: `Email ${emailTypeLabel(row.email_type)} — ${rel?.training_name ?? "Formation"}`,
      tag: "Email",
      type: "email",
      accent: false,
      path: rel?.id ? `/formation/${rel.id}` : "/formations",
    };
  });

  const fromCrmEmails: DashboardAgendaItem[] = ((crmEmailsRes.data ?? []) as CrmEmailRow[]).map((row) => {
    const rel = unwrap(row.crm_cards);
    return {
      time: tzHourMin(row.scheduled_at),
      dur: "",
      title: `Email — ${row.subject || rel?.title || "Envoi CRM"}`,
      tag: "Email",
      type: "email",
      accent: false,
      path: rel?.id ? `/crm?card=${rel.id}` : "/crm",
    };
  });

  const fromCoaching: DashboardAgendaItem[] = ((coachingBookingsRes.data ?? []) as CoachingBookingRow[]).map((row) => {
    const rel = unwrap(row.trainings);
    return {
      time: tzHourMin(row.requested_date),
      dur: row.duration_minutes ? `${row.duration_minutes} min` : "",
      title: `Coaching — ${rel?.training_name ?? "Formation"}`,
      tag: "Coaching",
      type: "coaching",
      accent: false,
      path: rel?.id ? `/formation/${rel.id}` : "/formations",
    };
  });

  return [
    ...fromSchedules,
    ...fromEvents,
    ...fromCrmCards,
    ...fromMissions,
    ...fromMissionActivities,
    ...fromTrainingEmails,
    ...fromCrmEmails,
    ...fromCoaching,
  ].sort((a, b) => {
    // Items without a specific time go last (treated as all-day context).
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

// ── Query: À votre attention ─────────────────────────────────

async function fetchAttention(): Promise<DashboardAttentionItem[]> {
  const today = todayAsISO();

  const [improvementsRes, supertiltRes, failedEmailsRes, evalsRes] = await Promise.all([
    supabase
      .from("improvements")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]),
    supabase
      .from("supertilt_actions")
      .select("id", { count: "exact", head: true })
      .eq("is_completed", false)
      .lte("deadline", today),
    supabase
      .from("failed_emails")
      .select("id", { count: "exact", head: true })
      .or("status.is.null,status.eq.failed"),
    supabase
      .from("training_evaluations")
      .select("id", { count: "exact", head: true })
      .eq("etat", "envoye"),
  ]);

  const items: DashboardAttentionItem[] = [];

  const improvements = improvementsRes.count ?? 0;
  if (improvements > 0) {
    items.push({
      icon: "clipboard",
      text: `${improvements} action${improvements > 1 ? "s" : ""} d'amélioration en cours`,
      path: "/ameliorations",
      tone: "info",
    });
  }

  const supertilt = supertiltRes.count ?? 0;
  if (supertilt > 0) {
    items.push({
      icon: "alert",
      text: `${supertilt} action${supertilt > 1 ? "s" : ""} SuperTilt à échéance`,
      path: "/supertilt",
      tone: "warn",
    });
  }

  const failed = failedEmailsRes.count ?? 0;
  if (failed > 0) {
    items.push({
      icon: "mail",
      text: `${failed} email${failed > 1 ? "s" : ""} en erreur d'envoi`,
      path: "/emails-erreur",
      tone: "warn",
    });
  }

  const evals = evalsRes.count ?? 0;
  if (evals > 0) {
    items.push({
      icon: "file",
      text: `${evals} évaluation${evals > 1 ? "s" : ""} en attente de retour`,
      path: "/evaluations",
      tone: "info",
    });
  }

  return items;
}

// ── Public hook ──────────────────────────────────────────────

export interface DashboardData {
  user: { firstName: string };
  kpis: DashboardKpi[];
  agenda: DashboardAgendaItem[];
  attention: DashboardAttentionItem[];
  insight: DashboardInsight;
  subtitle: string;
  isLoading: boolean;
}

async function fetchCurrentProfile(): Promise<{ firstName: string; userId: string | null }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id ?? null;
  const email = session.session?.user?.email ?? "";
  if (!userId) return { firstName: email.split("@")[0] || "", userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  const firstName = profile?.first_name?.trim()
    || (profile?.email ?? email).split("@")[0]
    || "";
  return { firstName, userId };
}

export function useDashboardData(): DashboardData {
  const today = useMemo(() => todayAsISO(), []);

  const profileQuery = useQuery({
    queryKey: ["dashboard", "profile"],
    queryFn: fetchCurrentProfile,
    staleTime: 15 * 60 * 1000,
  });

  const userId = profileQuery.data?.userId ?? null;

  const kpisQuery = useQuery({
    queryKey: ["dashboard", "kpis", today],
    queryFn: fetchKpis,
    staleTime: 5 * 60 * 1000,
  });

  const agendaQuery = useQuery({
    queryKey: ["dashboard", "agenda", today, userId],
    queryFn: () => fetchAgenda(today, userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const attentionQuery = useQuery({
    queryKey: ["dashboard", "attention"],
    queryFn: fetchAttention,
    staleTime: 60 * 1000,
  });

  const kpis = kpisQuery.data ? buildKpis(kpisQuery.data) : [];
  const agenda = agendaQuery.data ?? [];
  const attention = attentionQuery.data ?? [];

  // Insight : pas encore de table okrs → message d'accueil dynamique basé sur le CA
  const insight: DashboardInsight = useMemo(() => {
    if (kpisQuery.data && kpisQuery.data.caSignedLastMonth > 0) {
      const delta = kpisQuery.data.caSignedThisMonth - kpisQuery.data.caSignedLastMonth;
      if (delta > 0) {
        return {
          headline: `Votre CA signé progresse de ${formatEur(delta)} par rapport au mois dernier`,
          detail: "Continuez sur cette lancée : relancez les devis ouverts pour sécuriser la fin de mois.",
          path: "/crm",
        };
      }
    }
    return {
      headline: "Un nouveau mois commence — ajustez vos priorités",
      detail: "Jetez un œil aux devis en attente et aux formations qui arrivent cette semaine.",
      path: "/crm",
    };
  }, [kpisQuery.data]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    const agendaCount = agendaQuery.data?.length ?? 0;
    const openQuotes = kpisQuery.data?.openQuotes ?? 0;
    const hasWarn = (attentionQuery.data ?? []).some((a) => a.tone === "warn");

    if (agendaCount > 0) {
      parts.push(`${agendaCount} événement${agendaCount > 1 ? "s" : ""} sur votre journée`);
    } else {
      parts.push("Journée dégagée");
    }
    if (openQuotes > 0) {
      parts.push(`${openQuotes} devis à suivre`);
    }
    if (hasWarn) {
      parts.push("quelques points à traiter");
    }
    return parts.join(", ") + ".";
  }, [agendaQuery.data, attentionQuery.data, kpisQuery.data]);

  return {
    user: { firstName: profileQuery.data?.firstName ?? "" },
    kpis,
    agenda,
    attention,
    insight,
    subtitle,
    isLoading: kpisQuery.isLoading || agendaQuery.isLoading || attentionQuery.isLoading,
  };
}

