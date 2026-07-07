import { describe, it, expect } from "vitest";
import {
  computeProfitabilityIndicators,
  defaultProfitabilitySettings,
  activityDays,
  HOURS_PER_DAY,
  type ProfitabilityActivity,
  type ProfitabilitySettings,
} from "./missionProfitability";
import type { Mission } from "@/types/missions";

// 1er juillet 2026 → 7 mois écoulés
const NOW = new Date(2026, 6, 1, 12, 0, 0);

function mission(overrides: Partial<Mission>): Mission {
  return {
    id: "m1",
    title: "Mission",
    description: null,
    client_name: null,
    client_contact: null,
    status: "completed",
    start_date: null,
    end_date: null,
    daily_rate: null,
    total_days: null,
    total_amount: null,
    initial_amount: null,
    consumed_amount: null,
    billed_amount: null,
    tags: [],
    color: "#000",
    position: 0,
    language: "fr",
    testimonial_status: "none",
    testimonial_last_sent_at: null,
    location: null,
    train_booked: false,
    hotel_booked: false,
    waiting_next_action_date: null,
    waiting_next_action_text: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    created_by: null,
    assigned_to: null,
    ...overrides,
  };
}

function activity(overrides: Partial<ProfitabilityActivity>): ProfitabilityActivity {
  return {
    mission_id: "m1",
    activity_date: "2026-03-15",
    duration_type: "days",
    duration: 1,
    billable_amount: 800,
    is_billed: true,
    ...overrides,
  };
}

describe("activityDays", () => {
  it("convertit les heures en jours sur la base de 6h/jour", () => {
    expect(activityDays("hours", HOURS_PER_DAY)).toBe(1);
    expect(activityDays("hours", 3)).toBe(0.5);
  });

  it("garde les jours tels quels", () => {
    expect(activityDays("days", 2.5)).toBe(2.5);
  });

  it("retourne 0 pour une durée nulle, négative ou invalide", () => {
    expect(activityDays("days", 0)).toBe(0);
    expect(activityDays("hours", -3)).toBe(0);
    expect(activityDays("days", NaN)).toBe(0);
  });
});

describe("computeProfitabilityIndicators", () => {
  it("calcule le TJM recommandé et l'objectif annuel depuis les paramètres", () => {
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, [], [], NOW);
    // 60000 + 45% charges sociales (27000) + 800×12 (9600) = 96600 ; +25% marge = 120750
    expect(r.annualGoal).toBe(120750);
    expect(r.recommendedTJM).toBe(Math.ceil(120750 / 180)); // 671
    // Seuil mensuel : 800 / 0.9 = 888.9 → 889
    expect(r.breakEvenMonthly).toBe(889);
  });

  it("ne divise pas par zéro quand billableDaysPerYear = 0 ou charges variables = 100%", () => {
    const s: ProfitabilitySettings = {
      ...defaultProfitabilitySettings,
      billableDaysPerYear: 0,
      variableChargesRate: 100,
    };
    const r = computeProfitabilityIndicators(s, [], [], NOW);
    expect(r.recommendedTJM).toBe(0);
    expect(r.breakEvenMonthly).toBe(0);
    expect(Number.isFinite(r.recommendedTJM)).toBe(true);
  });

  it("ne compte que les activités facturées des missions terminées de l'année en cours", () => {
    const missions = [
      mission({ id: "done", status: "completed" }),
      mission({ id: "wip", status: "in_progress" }),
    ];
    const activities = [
      activity({ mission_id: "done", billable_amount: 1000, duration: 1 }),
      activity({ mission_id: "done", billable_amount: 500, is_billed: false }), // non facturée
      activity({ mission_id: "done", billable_amount: 900, activity_date: "2025-11-10" }), // année passée
      activity({ mission_id: "wip", billable_amount: 700 }), // mission en cours
    ];
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, missions, activities, NOW);
    expect(r.totalBilledCA).toBe(1000);
    expect(r.totalBilledDays).toBe(1);
    expect(r.totalWorkedDays).toBe(2); // facturée + non facturée de l'année
    expect(r.activeMissions).toBe(1);
    expect(r.completedMissions).toBe(1);
  });

  it("convertit les heures en jours pour le TJM réel", () => {
    const missions = [mission({ id: "m1" })];
    const activities = [
      activity({ duration_type: "hours", duration: 12, billable_amount: 1600 }), // 2 jours
    ];
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, missions, activities, NOW);
    expect(r.totalBilledDays).toBe(2);
    expect(r.actualTJM).toBe(800);
  });

  it("calcule le reste à facturer sur les missions non annulées, borné à 0 par mission", () => {
    const missions = [
      mission({ id: "a", initial_amount: 5000 }),
      mission({ id: "b", initial_amount: 1000 }), // surfacturée : 1500 facturés
      mission({ id: "c", status: "cancelled", initial_amount: 9999 }), // annulée : ignorée
    ];
    const activities = [
      activity({ mission_id: "a", billable_amount: 2000 }),
      activity({ mission_id: "b", billable_amount: 1500 }),
    ];
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, missions, activities, NOW);
    // a: 5000-2000 = 3000 ; b: max(0, 1000-1500) = 0 ; c ignorée
    expect(r.totalRemainingToBill).toBe(3000);
  });

  it("calcule la progression vs objectif annuel et la progression attendue", () => {
    const missions = [mission({ id: "m1" })];
    const activities = [activity({ billable_amount: 60375 })]; // 50% de 120750
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, missions, activities, NOW);
    expect(r.progressPercentage).toBe(50);
    expect(r.monthsElapsed).toBe(7);
    expect(r.expectedProgress).toBe(58); // 7/12 arrondi
    expect(r.isOnTrack).toBe(true); // 50 >= 58 - 10
  });

  it("calcule la marge nette sur base facturée", () => {
    const missions = [mission({ id: "m1" })];
    const activities = [activity({ billable_amount: 10000 })];
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, missions, activities, NOW);
    // 10000 - 10% variables (1000) - 800×7 fixes (5600) = 3400 → 34%
    expect(r.netProfit).toBe(3400);
    expect(r.netMarginRate).toBe(34);
  });

  it("retourne des indicateurs neutres sans données", () => {
    const r = computeProfitabilityIndicators(defaultProfitabilitySettings, [], [], NOW);
    expect(r.totalBilledCA).toBe(0);
    expect(r.actualTJM).toBe(0);
    expect(r.netMarginRate).toBe(0);
    expect(r.progressPercentage).toBe(0);
    expect(r.totalRemainingToBill).toBe(0);
  });
});
