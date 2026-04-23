import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { todayAsISO, dateAsISO } from "@/lib/dateFormatters";

// ── Types ────────────────────────────────────────────────────

export type KpiTrend = "up" | "warn" | "flat";
export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: KpiTrend;
  spark: number[];
}

export interface DashboardAgendaItem {
  time: string;
  dur: string;
  title: string;
  tag: string;
  accent: boolean;
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

// ── Helpers ──────────────────────────────────────────────────

const EUR_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatEur(value: number): string {
  return EUR_FORMATTER.format(Math.round(value));
}

function toHourMin(time: string | null): string {
  if (!time) return "--:--";
  const [h, m] = time.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").slice(0, 2)}`;
}

function durationLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// ── Query: KPIs ──────────────────────────────────────────────

interface KpiData {
  caSignedThisMonth: number;
  caSignedLastMonth: number;
  activeMissions: number;
  newMissionsThisWeek: number;
  upcomingTrainings: number;
  upcomingThisWeek: number;
  openQuotes: number;
}

async function fetchKpis(): Promise<KpiData> {
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

function buildKpis(data: KpiData): DashboardKpi[] {
  const caDelta = data.caSignedLastMonth > 0
    ? ((data.caSignedThisMonth - data.caSignedLastMonth) / data.caSignedLastMonth) * 100
    : data.caSignedThisMonth > 0 ? 100 : 0;
  const caTrend: KpiTrend = caDelta > 0 ? "up" : caDelta < -10 ? "warn" : "flat";
  const caDeltaLabel = caDelta === 0 ? "—" : `${caDelta > 0 ? "+" : ""}${caDelta.toFixed(1)} %`;

  return [
    {
      id: "ca",
      label: "CA signé ce mois",
      value: formatEur(data.caSignedThisMonth),
      delta: caDeltaLabel,
      trend: caTrend,
      // Sparkline placeholder: deux points (mois précédent → ce mois)
      spark: [data.caSignedLastMonth || 1, data.caSignedThisMonth || 1],
    },
    {
      id: "missions",
      label: "Missions actives",
      value: String(data.activeMissions),
      delta: data.newMissionsThisWeek > 0 ? `${data.newMissionsThisWeek} nouvelle${data.newMissionsThisWeek > 1 ? "s" : ""}` : "— cette semaine",
      trend: data.newMissionsThisWeek > 0 ? "up" : "flat",
      spark: [Math.max(1, data.activeMissions - data.newMissionsThisWeek), data.activeMissions || 1],
    },
    {
      id: "formations",
      label: "Formations à venir",
      value: String(data.upcomingTrainings),
      delta: data.upcomingThisWeek > 0 ? `${data.upcomingThisWeek} cette semaine` : "aucune cette semaine",
      trend: "flat",
      spark: [data.upcomingTrainings || 1, data.upcomingTrainings || 1],
    },
    {
      id: "devis",
      label: "Devis en attente",
      value: String(data.openQuotes),
      delta: data.openQuotes > 0 ? "à suivre" : "tout est à jour",
      trend: data.openQuotes > 3 ? "warn" : "flat",
      spark: [Math.max(1, data.openQuotes - 1), data.openQuotes || 1],
    },
  ];
}

// ── Query: Agenda du jour ────────────────────────────────────

async function fetchAgenda(today: string): Promise<DashboardAgendaItem[]> {
  const [schedulesRes, eventsRes] = await Promise.all([
    supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time, trainings(training_name)")
      .eq("day_date", today)
      .order("start_time", { ascending: true }),
    supabase
      .from("events")
      .select("id, event_date, event_time, title, location")
      .eq("event_date", today)
      .order("event_time", { ascending: true }),
  ]);

  type ScheduleRow = {
    start_time: string | null;
    end_time: string | null;
    trainings: { training_name: string | null } | { training_name: string | null }[] | null;
  };
  type EventRow = {
    event_time: string | null;
    title: string | null;
    location: string | null;
  };

  const fromSchedules: DashboardAgendaItem[] = ((schedulesRes.data ?? []) as ScheduleRow[]).map((row) => {
    const rel = Array.isArray(row.trainings) ? row.trainings[0] : row.trainings;
    const name = rel?.training_name ?? "Formation";
    return {
      time: toHourMin(row.start_time),
      dur: durationLabel(row.start_time, row.end_time),
      title: `Formation — ${name}`,
      tag: "Formation",
      accent: true,
    };
  });

  const fromEvents: DashboardAgendaItem[] = ((eventsRes.data ?? []) as EventRow[]).map((row) => ({
    time: toHourMin(row.event_time),
    dur: "",
    title: row.title || "Événement",
    tag: row.location ? row.location : "Événement",
    accent: false,
  }));

  return [...fromSchedules, ...fromEvents].sort((a, b) => a.time.localeCompare(b.time));
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

async function fetchCurrentProfile(): Promise<{ firstName: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  const email = session.session?.user?.email ?? "";
  if (!userId) return { firstName: email.split("@")[0] || "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  const firstName = profile?.first_name?.trim()
    || (profile?.email ?? email).split("@")[0]
    || "";
  return { firstName };
}

export function useDashboardData(): DashboardData {
  const today = useMemo(() => todayAsISO(), []);

  const profileQuery = useQuery({
    queryKey: ["dashboard", "profile"],
    queryFn: fetchCurrentProfile,
    staleTime: 15 * 60 * 1000,
  });

  const kpisQuery = useQuery({
    queryKey: ["dashboard", "kpis", today],
    queryFn: fetchKpis,
    staleTime: 5 * 60 * 1000,
  });

  const agendaQuery = useQuery({
    queryKey: ["dashboard", "agenda", today],
    queryFn: () => fetchAgenda(today),
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
    user: profileQuery.data ?? { firstName: "" },
    kpis,
    agenda,
    attention,
    insight,
    subtitle,
    isLoading: kpisQuery.isLoading || agendaQuery.isLoading || attentionQuery.isLoading,
  };
}

