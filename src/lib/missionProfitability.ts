import type { Mission } from "@/types/missions";

/** Hours-to-days conversion used by the profitability dashboard. */
export const HOURS_PER_DAY = 6;

export interface ProfitabilitySettings {
  targetNetSalary: number; // Salaire net annuel visé
  socialChargesRate: number; // Taux de charges sociales (%)
  fixedChargesMonthly: number; // Charges fixes mensuelles
  variableChargesRate: number; // Taux de charges variables (%)
  targetMarginRate: number; // Marge bénéficiaire cible (%)
  billableDaysPerYear: number; // Jours facturables par an
}

export const defaultProfitabilitySettings: ProfitabilitySettings = {
  targetNetSalary: 60000,
  socialChargesRate: 45,
  fixedChargesMonthly: 800,
  variableChargesRate: 10,
  targetMarginRate: 25,
  billableDaysPerYear: 180,
};

/** Champs minimaux d'une activité mission nécessaires au calcul. */
export interface ProfitabilityActivity {
  mission_id: string;
  activity_date: string | null;
  duration_type: string;
  duration: number;
  billable_amount: number | null;
  is_billed: boolean;
}

export interface ProfitabilityIndicators {
  recommendedTJM: number;
  breakEvenMonthly: number;
  totalBilledCA: number;
  totalRemainingToBill: number;
  totalInitialBudget: number;
  totalBilledDays: number;
  totalWorkedDays: number;
  actualTJM: number;
  annualGoal: number;
  progressPercentage: number;
  expectedProgress: number;
  netMarginRate: number;
  netProfit: number;
  isOnTrack: boolean;
  tjmIsGood: boolean;
  monthsElapsed: number;
  activeMissions: number;
  completedMissions: number;
}

/** Activity → billable days (1j = 6h). */
export function activityDays(durationType: string, duration: number): number {
  const n = Number(duration) || 0;
  if (n <= 0) return 0;
  return durationType === "hours" ? n / HOURS_PER_DAY : n;
}

/**
 * Indicateurs de rentabilité missions.
 *
 * Source of truth: `mission_activities` (not `missions.billed_amount`).
 * Filtres :
 *   - mission.status === 'completed' → "missions terminées"
 *   - activity.is_billed === true   → "activités facturées"
 * Les durées en heures sont converties en jours via HOURS_PER_DAY (6h = 1j).
 */
export function computeProfitabilityIndicators(
  settings: ProfitabilitySettings,
  missions: Mission[],
  allActivities: ProfitabilityActivity[],
  now: Date = new Date(),
): ProfitabilityIndicators {
  const s = settings;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const yearStart = new Date(currentYear, 0, 1);

  // Annual cost + target
  const socialCharges = s.targetNetSalary * (s.socialChargesRate / 100);
  const fixedChargesAnnual = s.fixedChargesMonthly * 12;
  const totalAnnualCosts = s.targetNetSalary + socialCharges + fixedChargesAnnual;
  const totalWithMargin = totalAnnualCosts * (1 + s.targetMarginRate / 100);
  const annualGoal = totalWithMargin;
  const recommendedTJM = s.billableDaysPerYear > 0
    ? Math.ceil(totalWithMargin / s.billableDaysPerYear)
    : 0;

  // Monthly break-even
  const marginRateOnVariableCosts = (100 - s.variableChargesRate) / 100;
  const breakEvenMonthly = marginRateOnVariableCosts > 0
    ? Math.ceil(s.fixedChargesMonthly / marginRateOnVariableCosts)
    : 0;

  const completedMissionIds = new Set(
    missions.filter((m) => m.status === "completed").map((m) => m.id),
  );

  // Activities that belong to a completed mission AND fall in the current year.
  const yearActivities = allActivities.filter((a) => {
    if (!completedMissionIds.has(a.mission_id)) return false;
    if (!a.activity_date) return false;
    const d = new Date(a.activity_date);
    return d >= yearStart && d <= now;
  });

  // Billed: activities marked is_billed === true
  const billedActivities = yearActivities.filter((a) => a.is_billed === true);
  const totalBilledCA = billedActivities.reduce((sum, a) => sum + (Number(a.billable_amount) || 0), 0);
  const totalBilledDays = billedActivities.reduce((sum, a) => sum + activityDays(a.duration_type, a.duration), 0);

  // Worked (all activities of completed missions, billed or not) — informational.
  const totalWorkedDays = yearActivities.reduce((sum, a) => sum + activityDays(a.duration_type, a.duration), 0);

  // Initial budget scope: sum of initial_amount on completed missions.
  const totalInitialBudget = missions
    .filter((m) => m.status === "completed")
    .reduce((sum, m) => sum + (m.initial_amount || 0), 0);

  // Reste à facturer total : sur toutes les missions non annulées,
  // budget initial - montants déjà facturés (activités is_billed),
  // borné à 0 par mission (une mission surfacturée ne compense pas les autres).
  const billedByMission = new Map<string, number>();
  for (const a of allActivities) {
    if (a.is_billed === true) {
      billedByMission.set(a.mission_id, (billedByMission.get(a.mission_id) || 0) + (Number(a.billable_amount) || 0));
    }
  }
  const totalRemainingToBill = missions
    .filter((m) => m.status !== "cancelled")
    .reduce((sum, m) => sum + Math.max(0, (m.initial_amount || 0) - (billedByMission.get(m.id) || 0)), 0);

  // Average realised TJM
  const actualTJM = totalBilledDays > 0 ? Math.round(totalBilledCA / totalBilledDays) : 0;

  // Progress vs. annual goal
  const progressPercentage = annualGoal > 0
    ? Math.min(100, Math.round((totalBilledCA / annualGoal) * 100))
    : 0;

  // Expected linear progress at this point in the year
  const monthsElapsed = currentMonth + 1;
  const expectedProgress = Math.round((monthsElapsed / 12) * 100);

  // Net margin calc (billed basis)
  const variableCosts = totalBilledCA * (s.variableChargesRate / 100);
  const netProfit = totalBilledCA - variableCosts - (s.fixedChargesMonthly * monthsElapsed);
  const netMarginRate = totalBilledCA > 0 ? Math.round((netProfit / totalBilledCA) * 100) : 0;

  const isOnTrack = progressPercentage >= expectedProgress - 10;
  const tjmIsGood = actualTJM >= recommendedTJM * 0.9;

  return {
    recommendedTJM,
    breakEvenMonthly,
    totalBilledCA,
    totalRemainingToBill,
    totalInitialBudget,
    totalBilledDays,
    totalWorkedDays,
    actualTJM,
    annualGoal,
    progressPercentage,
    expectedProgress,
    netMarginRate,
    netProfit,
    isOnTrack,
    tjmIsGood,
    monthsElapsed,
    activeMissions: missions.filter((m) => m.status === "in_progress").length,
    completedMissions: completedMissionIds.size,
  };
}
