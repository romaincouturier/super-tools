import { OKRObjective, OKRKeyResult, OKRCheckIn } from "@/types/okr";
import { differenceInDays, startOfDay, endOfQuarter, endOfYear, parseISO, startOfQuarter } from "date-fns";

// ─── Risk alert types ───

export type RiskSeverity = "critical" | "warning" | "info";
export type RiskType =
  | "confidence_declining"
  | "progress_stalled"
  | "behind_schedule"
  | "no_recent_checkin"
  | "no_key_results"
  | "low_confidence";

export interface OKRRiskAlert {
  type: RiskType;
  severity: RiskSeverity;
  objectiveId: string;
  objectiveTitle: string;
  keyResultId?: string;
  keyResultTitle?: string;
  message: string;
}

// ─── Momentum analysis ───

export interface MomentumData {
  objectiveId: string;
  title: string;
  progressDelta: number; // change over last N check-ins
  confidenceDelta: number;
  trend: "accelerating" | "steady" | "stalling" | "declining";
}

// ─── Helpers ───

function getTimeTargetEndDate(timeTarget: string, year: number): Date {
  switch (timeTarget) {
    case "Q1": return new Date(year, 2, 31);
    case "Q2": return new Date(year, 5, 30);
    case "Q3": return new Date(year, 8, 30);
    case "Q4": return new Date(year, 11, 31);
    case "S1": return new Date(year, 5, 30);
    case "S2": return new Date(year, 11, 31);
    case "annual": return new Date(year, 11, 31);
    default: return new Date(year, 11, 31);
  }
}

function getTimeTargetStartDate(timeTarget: string, year: number): Date {
  switch (timeTarget) {
    case "Q1": return new Date(year, 0, 1);
    case "Q2": return new Date(year, 3, 1);
    case "Q3": return new Date(year, 6, 1);
    case "Q4": return new Date(year, 9, 1);
    case "S1": return new Date(year, 0, 1);
    case "S2": return new Date(year, 6, 1);
    case "annual": return new Date(year, 0, 1);
    default: return new Date(year, 0, 1);
  }
}

// ─── Risk detection ───

export function computeRiskAlerts(
  objectives: OKRObjective[],
  keyResultsByObjective: Record<string, OKRKeyResult[]>,
  checkInsByObjective: Record<string, OKRCheckIn[]>,
): OKRRiskAlert[] {
  const alerts: OKRRiskAlert[] = [];
  const now = startOfDay(new Date());

  for (const obj of objectives) {
    if (obj.status !== "active") continue;

    const krs = keyResultsByObjective[obj.id] || [];
    const checkIns = (checkInsByObjective[obj.id] || [])
      .sort((a, b) => new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime());

    // No key results
    if (krs.length === 0) {
      alerts.push({
        type: "no_key_results",
        severity: "warning",
        objectiveId: obj.id,
        objectiveTitle: obj.title,
        message: `Aucun résultat clé défini`,
      });
    }

    // No recent check-in (> 2x cadence)
    const cadenceDays = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 }[obj.cadence] || 30;
    const lastCheckIn = checkIns[0];
    if (lastCheckIn) {
      const daysSince = differenceInDays(now, new Date(lastCheckIn.check_in_date));
      if (daysSince > cadenceDays * 2) {
        alerts.push({
          type: "no_recent_checkin",
          severity: "warning",
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          message: `Aucun suivi depuis ${daysSince} jours (cadence : ${cadenceDays}j)`,
        });
      }
    } else if (differenceInDays(now, new Date(obj.created_at)) > cadenceDays) {
      alerts.push({
        type: "no_recent_checkin",
        severity: "info",
        objectiveId: obj.id,
        objectiveTitle: obj.title,
        message: `Aucun suivi enregistré depuis la création`,
      });
    }

    // Confidence declining over last 3 check-ins
    if (checkIns.length >= 3) {
      const recent3 = checkIns.slice(0, 3);
      const allDeclining = recent3.every((ci, i) => {
        if (i === recent3.length - 1) return true;
        return (ci.new_confidence ?? 50) <= (recent3[i + 1]?.new_confidence ?? 50);
      });
      if (allDeclining && (recent3[0].new_confidence ?? 50) < (recent3[recent3.length - 1].new_confidence ?? 50)) {
        const drop = (recent3[recent3.length - 1].new_confidence ?? 50) - (recent3[0].new_confidence ?? 50);
        alerts.push({
          type: "confidence_declining",
          severity: drop > 20 ? "critical" : "warning",
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          message: `Confiance en baisse sur 3 suivis consécutifs (−${drop}pts)`,
        });
      }
    }

    // Low confidence
    if (obj.confidence_level < 40) {
      alerts.push({
        type: "low_confidence",
        severity: obj.confidence_level < 20 ? "critical" : "warning",
        objectiveId: obj.id,
        objectiveTitle: obj.title,
        message: `Confiance très basse : ${obj.confidence_level}%`,
      });
    }

    // Behind schedule: expected progress vs actual
    const endDate = getTimeTargetEndDate(obj.time_target, obj.target_year);
    const startDate = getTimeTargetStartDate(obj.time_target, obj.target_year);
    const totalDays = differenceInDays(endDate, startDate);
    const elapsed = differenceInDays(now, startDate);
    if (totalDays > 0 && elapsed > 0) {
      const expectedProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));
      const gap = expectedProgress - obj.progress_percentage;
      if (gap > 25) {
        alerts.push({
          type: "behind_schedule",
          severity: gap > 40 ? "critical" : "warning",
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          message: `En retard de ${gap}pts (attendu ~${expectedProgress}%, actuel ${obj.progress_percentage}%)`,
        });
      }
    }

    // Progress stalled: last 3 check-ins with < 5% total change
    if (checkIns.length >= 3) {
      const recent3 = checkIns.slice(0, 3);
      const progressRange = Math.abs(
        (recent3[0].new_progress ?? 0) - (recent3[recent3.length - 1].new_progress ?? 0)
      );
      if (progressRange < 5 && obj.progress_percentage < 90) {
        alerts.push({
          type: "progress_stalled",
          severity: "warning",
          objectiveId: obj.id,
          objectiveTitle: obj.title,
          message: `Progression stagnante (< 5pts de variation sur 3 suivis)`,
        });
      }
    }
  }

  // Sort by severity
  const severityOrder: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ─── Momentum analysis ───

export function computeMomentum(
  objectives: OKRObjective[],
  checkInsByObjective: Record<string, OKRCheckIn[]>,
): MomentumData[] {
  return objectives
    .filter((obj) => obj.status === "active")
    .map((obj) => {
      const checkIns = (checkInsByObjective[obj.id] || [])
        .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());

      let progressDelta = 0;
      let confidenceDelta = 0;

      if (checkIns.length >= 2) {
        const oldest = checkIns[Math.max(0, checkIns.length - 4)];
        const newest = checkIns[checkIns.length - 1];
        progressDelta = (newest.new_progress ?? 0) - (oldest.new_progress ?? 0);
        confidenceDelta = (newest.new_confidence ?? 50) - (oldest.new_confidence ?? 50);
      }

      let trend: MomentumData["trend"] = "steady";
      if (progressDelta > 15) trend = "accelerating";
      else if (progressDelta > 5) trend = "steady";
      else if (progressDelta > -5) trend = "stalling";
      else trend = "declining";

      return {
        objectiveId: obj.id,
        title: obj.title,
        progressDelta,
        confidenceDelta,
        trend,
      };
    });
}

// ─── Executive snapshot ───

export interface OKRSnapshot {
  totalActive: number;
  avgProgress: number;
  avgConfidence: number;
  onTrack: number;
  atRisk: number;
  behind: number;
  topWins: { title: string; progress: number }[];
  topRisks: { title: string; confidence: number; reason: string }[];
  weeklyProgressDelta: number;
  weeklyConfidenceDelta: number;
}

export function computeSnapshot(
  objectives: OKRObjective[],
  checkInsByObjective: Record<string, OKRCheckIn[]>,
  alerts: OKRRiskAlert[],
): OKRSnapshot {
  const active = objectives.filter((o) => o.status === "active");
  const totalActive = active.length;

  const avgProgress = totalActive
    ? Math.round(active.reduce((s, o) => s + o.progress_percentage, 0) / totalActive)
    : 0;
  const avgConfidence = totalActive
    ? Math.round(active.reduce((s, o) => s + o.confidence_level, 0) / totalActive)
    : 0;

  const onTrack = active.filter((o) => o.confidence_level >= 70).length;
  const atRisk = active.filter((o) => o.confidence_level >= 40 && o.confidence_level < 70).length;
  const behind = active.filter((o) => o.confidence_level < 40).length;

  const topWins = [...active]
    .sort((a, b) => b.progress_percentage - a.progress_percentage)
    .slice(0, 3)
    .map((o) => ({ title: o.title, progress: o.progress_percentage }));

  const criticalIds = new Set(alerts.filter((a) => a.severity === "critical").map((a) => a.objectiveId));
  const topRisks = active
    .filter((o) => criticalIds.has(o.id) || o.confidence_level < 50)
    .sort((a, b) => a.confidence_level - b.confidence_level)
    .slice(0, 3)
    .map((o) => ({
      title: o.title,
      confidence: o.confidence_level,
      reason: alerts.find((a) => a.objectiveId === o.id)?.message || "Confiance basse",
    }));

  // Weekly deltas from check-ins
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  let weeklyProgressDelta = 0;
  let weeklyConfidenceDelta = 0;
  let countWithRecent = 0;

  for (const obj of active) {
    const checkIns = (checkInsByObjective[obj.id] || [])
      .filter((ci) => new Date(ci.check_in_date) >= twoWeeksAgo)
      .sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());

    if (checkIns.length >= 2) {
      const first = checkIns[0];
      const last = checkIns[checkIns.length - 1];
      weeklyProgressDelta += (last.new_progress ?? 0) - (first.new_progress ?? 0);
      weeklyConfidenceDelta += (last.new_confidence ?? 50) - (first.new_confidence ?? 50);
      countWithRecent++;
    }
  }

  if (countWithRecent > 0) {
    weeklyProgressDelta = Math.round(weeklyProgressDelta / countWithRecent);
    weeklyConfidenceDelta = Math.round(weeklyConfidenceDelta / countWithRecent);
  }

  return {
    totalActive,
    avgProgress,
    avgConfidence,
    onTrack,
    atRisk,
    behind,
    topWins,
    topRisks,
    weeklyProgressDelta,
    weeklyConfidenceDelta,
  };
}
