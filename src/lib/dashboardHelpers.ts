// Pure helpers for the Dashboard aggregation hook.
// Kept in src/lib/ so they are testable without pulling React Query / Supabase.

import { startOfWeek, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export interface WeeklyData {
  week: string;
  count: number;
}

/** Compte les dates par semaine (labels "dd/MM", lundi = début de semaine). */
export function processWeeklyData(dates: string[], allWeeks: string[]): WeeklyData[] {
  const weekCounts: Record<string, number> = {};

  // Initialize all weeks with 0
  allWeeks.forEach((week) => {
    weekCounts[week] = 0;
  });

  // Count occurrences per week
  dates.forEach((dateStr) => {
    try {
      // Handle both ISO date strings and date-only formats
      const date = dateStr.includes("T") ? parseISO(dateStr) : new Date(dateStr);
      if (isNaN(date.getTime())) return;

      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekLabel = format(weekStart, "dd/MM", { locale: fr });
      if (weekCounts[weekLabel] !== undefined) {
        weekCounts[weekLabel]++;
      }
    } catch (e) {
      console.error("Error parsing date:", dateStr, e);
    }
  });

  return allWeeks.map((week) => ({
    week,
    count: weekCounts[week] || 0,
  }));
}

export type DashboardKpiTrend = "up" | "warn" | "flat";

export interface DashboardKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: DashboardKpiTrend;
  spark: number[];
}

export interface DashboardKpiSource {
  caSignedThisMonth: number;
  caSignedLastMonth: number;
  activeMissions: number;
  newMissionsThisWeek: number;
  upcomingTrainings: number;
  upcomingThisWeek: number;
  openQuotes: number;
}

const EUR_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(value: number): string {
  return EUR_FORMATTER.format(Math.round(value));
}

export function toHourMin(time: string | null): string {
  if (!time) return "--:--";
  const parts = time.split(":");
  const h = (parts[0] ?? "").padStart(2, "0");
  const m = (parts[1] ?? "00").slice(0, 2);
  return `${h}:${m}`;
}

export function durationLabel(start: string | null, end: string | null): string {
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

export function greetingFor(hour: number): string {
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

export function formatToday(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildKpis(data: DashboardKpiSource): DashboardKpi[] {
  const caDelta = data.caSignedLastMonth > 0
    ? ((data.caSignedThisMonth - data.caSignedLastMonth) / data.caSignedLastMonth) * 100
    : data.caSignedThisMonth > 0 ? 100 : 0;
  const caTrend: DashboardKpiTrend = caDelta > 0 ? "up" : caDelta < -10 ? "warn" : "flat";
  const caDeltaLabel = caDelta === 0 ? "—" : `${caDelta > 0 ? "+" : ""}${caDelta.toFixed(1)} %`;

  return [
    {
      id: "ca",
      label: "CA signé ce mois",
      value: formatEur(data.caSignedThisMonth),
      delta: caDeltaLabel,
      trend: caTrend,
      spark: [data.caSignedLastMonth || 1, data.caSignedThisMonth || 1],
    },
    {
      id: "missions",
      label: "Missions actives",
      value: String(data.activeMissions),
      delta: data.newMissionsThisWeek > 0
        ? `${data.newMissionsThisWeek} nouvelle${data.newMissionsThisWeek > 1 ? "s" : ""}`
        : "— cette semaine",
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
