import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CrmCard, CrmColumn, CrmRevenueTarget } from "@/types/crm";
import type { OKRObjective, OKRKeyResult } from "@/types/okr";
import type { Mission } from "@/types/missions";

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/arena/api", () => ({
  loadArenaApiKeys: vi.fn(),
  saveArenaApiKeys: vi.fn(),
}));
vi.mock("@/lib/arena/templates", () => ({ TEMPLATES: [] }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const {
  fmtEuro,
  hasAnyProvider,
  buildAmbitionContext,
  buildOKRContext,
  buildCRMContext,
  buildAcquisitionContext,
  buildRevenueTargetContext,
  buildCalendarContext,
  buildMissionsContext,
  buildFormationsContext,
  buildCrmCommentsContext,
  buildCrmEmailsContext,
  buildTrainingEvaluationsContext,
  buildSponsorEvaluationsContext,
  buildMissionActivitiesContext,
  buildCrmActivityLogContext,
} = await import("./useCommercialCoachData");

// ── Fixed time ───────────────────────────────────────────────────────────────
// All tests run at 2025-03-15 12:00:00 UTC for determinism
const FIXED_NOW = new Date("2025-03-15T12:00:00Z");
const FIXED_YEAR = 2025;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Typed Factories ──────────────────────────────────────────────────────────

type ObjWithKR = OKRObjective & { okr_key_results: OKRKeyResult[] };

function makeCard(overrides: Partial<CrmCard> = {}): CrmCard {
  return {
    id: "card-1",
    title: "Deal Alpha",
    description_html: null,
    position: 0,
    column_id: "col-1",
    status_operational: "TODAY",
    waiting_next_action_date: null,
    waiting_next_action_text: null,
    sales_status: "OPEN",
    first_name: null,
    last_name: null,
    phone: null,
    company: null,
    email: null,
    linkedin_url: null,
    website_url: null,
    estimated_value: null,
    quote_url: null,
    confidence_score: null,
    won_at: null,
    lost_at: null,
    acquisition_source: null,
    loss_reason: null,
    loss_reason_detail: null,
    next_action_text: null,
    next_action_done: false,
    next_action_type: "other",
    linked_mission_id: null,
    service_type: null,
    brief_questions: [],
    raw_input: null,
    tags: [],
    assigned_to: null,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

function makeColumn(overrides: Partial<CrmColumn> = {}): CrmColumn {
  return {
    id: "col-1",
    name: "Prospection",
    position: 0,
    is_archived: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeObjective(overrides: Partial<ObjWithKR> = {}): ObjWithKR {
  return {
    id: "obj-1",
    title: "Croissance CA",
    description: "Doubler le CA",
    time_target: "annual",
    target_year: FIXED_YEAR,
    status: "active",
    cadence: "monthly",
    is_favorite: false,
    favorite_position: null,
    progress_percentage: 50,
    confidence_level: 70,
    owner_email: "test@test.com",
    color: "#3B82F6",
    position: 0,
    next_review_date: null,
    next_review_agenda: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    created_by: "user-1",
    okr_key_results: [],
    ...overrides,
  };
}

function makeKeyResult(overrides: Partial<OKRKeyResult> = {}): OKRKeyResult {
  return {
    id: "kr-1",
    objective_id: "obj-1",
    title: "Signer 10 deals",
    description: null,
    target_value: 10,
    current_value: 5,
    unit: "deals",
    progress_percentage: 50,
    confidence_level: 60,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission-1",
    title: "Mission Coaching",
    description: "Coaching agile",
    status: "in_progress",
    client_name: "ClientCo",
    client_contact: "Jean Martin",
    start_date: "2025-02-01",
    end_date: "2025-06-30",
    daily_rate: 1200,
    total_days: 20,
    total_amount: 24000,
    initial_amount: 24000,
    consumed_amount: 8000,
    billed_amount: 6000,
    tags: [],
    color: "#3b82f6",
    position: 0,
    language: "fr",
    testimonial_status: "none",
    testimonial_last_sent_at: null,
    location: null,
    train_booked: false,
    hotel_booked: false,
    waiting_next_action_date: null,
    waiting_next_action_text: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-02-01T00:00:00Z",
    created_by: "user-1",
    assigned_to: null,
    ...overrides,
  };
}

function makeRevenueTarget(overrides: Partial<CrmRevenueTarget> = {}): CrmRevenueTarget {
  return {
    id: "target-1",
    period_type: "monthly",
    period_start: "2025-06-01",
    target_amount: 10000,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    created_by: "user-1",
    ...overrides,
  };
}

// Narrow no-break space used by fr-FR locale as thousands separator (U+202F)
const S = "\u202f";

// ═════════════════════════════════════════════════════════════════════════════
// fmtEuro
// ═════════════════════════════════════════════════════════════════════════════

describe("fmtEuro", () => {
  describe("cas nominaux", () => {
    it("formate un entier avec séparateur de milliers", () => {
      expect(fmtEuro(1500)).toBe(`1${S}500€`);
    });

    it("formate un grand nombre avec séparateurs", () => {
      expect(fmtEuro(1500000)).toBe(`1${S}500${S}000€`);
    });

    it("formate zéro", () => {
      expect(fmtEuro(0)).toBe("0€");
    });

    it("formate un nombre décimal", () => {
      expect(fmtEuro(1234.56)).toBe(`1${S}234,56€`);
    });

    it("formate un petit nombre sans séparateur", () => {
      expect(fmtEuro(42)).toBe("42€");
    });
  });

  describe("cas aux limites", () => {
    it("retourne le tiret pour null", () => {
      expect(fmtEuro(null)).toBe("—");
    });

    it("retourne le tiret pour undefined", () => {
      expect(fmtEuro(undefined)).toBe("—");
    });

    it("formate un nombre négatif en conservant le signe", () => {
      const result = fmtEuro(-500);
      expect(result).toBe("-500€");
    });

    it("formate un très grand nombre", () => {
      expect(fmtEuro(999999999)).toBe(`999${S}999${S}999€`);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// hasAnyProvider
// ═════════════════════════════════════════════════════════════════════════════

describe("hasAnyProvider", () => {
  it("retourne toujours true (Claude server-side)", () => {
    expect(hasAnyProvider({} as any)).toBe(true);
    expect(hasAnyProvider({ openai: "key" } as any)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildAmbitionContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildAmbitionContext", () => {
  // Use FIXED_YEAR — new Date().getFullYear() at describe scope runs before fake timers
  const currentYear = FIXED_YEAR;

  describe("cas nominaux", () => {
    it("affiche le texte d'ambition utilisateur", () => {
      const result = buildAmbitionContext([], "Devenir leader du marché");
      expect(result).toContain("Vision et ambition");
      expect(result).toContain("Devenir leader du marché");
      expect(result).toContain(String(currentYear));
    });

    it("affiche les OKR annuels de l'année en cours", () => {
      const obj = makeObjective({
        okr_key_results: [makeKeyResult()],
      });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("OKR annuels");
      expect(result).toContain("Croissance CA");
      expect(result).toContain("Progression: 50%");
      expect(result).toContain("Confiance: 70%");
    });

    it("affiche ambition + OKR combinés", () => {
      const obj = makeObjective({ okr_key_results: [makeKeyResult()] });
      const result = buildAmbitionContext([obj], "Mon ambition");
      expect(result).toContain("Mon ambition");
      expect(result).toContain("OKR annuels");
      expect(result).toContain("Croissance CA");
    });

    it("affiche les résultats clés avec valeurs", () => {
      const kr = makeKeyResult({ target_value: 10, current_value: 5, unit: "deals" });
      const obj = makeObjective({ okr_key_results: [kr] });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("5/10 deals");
      expect(result).toContain("50%");
    });

    it("affiche le pourcentage quand target_value est null", () => {
      const kr = makeKeyResult({ target_value: null, progress_percentage: 75 });
      const obj = makeObjective({ okr_key_results: [kr] });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("75%");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans ambition ni OKR", () => {
      const result = buildAmbitionContext([]);
      expect(result).toContain("Aucune ambition annuelle definie");
    });

    it("ignore le texte d'ambition vide ou whitespace", () => {
      expect(buildAmbitionContext([], "")).toContain("Aucune ambition");
      expect(buildAmbitionContext([], "   ")).toContain("Aucune ambition");
    });

    it("ignore les OKR d'une autre année", () => {
      const obj = makeObjective({ target_year: currentYear - 1 });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("Aucune ambition");
    });

    it("ignore les OKR non-annuels", () => {
      const obj = makeObjective({ time_target: "Q1" });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("Aucune ambition");
    });

    it("gère un objectif sans key_results", () => {
      const obj = makeObjective({ okr_key_results: [] });
      const result = buildAmbitionContext([obj]);
      expect(result).toContain("Croissance CA");
      expect(result).not.toContain("Resultats cles");
    });

    it("gère un objectif sans description", () => {
      const obj = makeObjective({ description: null, okr_key_results: [] });
      const result = buildAmbitionContext([obj]);
      expect(result).not.toContain("Vision:");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildOKRContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildOKRContext", () => {
  // Use FIXED_YEAR — new Date().getFullYear() at describe scope runs before fake timers
  const currentYear = FIXED_YEAR;

  describe("cas nominaux", () => {
    it("affiche les OKR non-annuels", () => {
      const obj = makeObjective({
        time_target: "Q1",
        title: "OKR Q1",
        okr_key_results: [makeKeyResult()],
      });
      const result = buildOKRContext([obj]);
      expect(result).toContain("OKR Q1");
      expect(result).toContain("Q1");
      expect(result).toContain("Signer 10 deals");
    });

    it("affiche les OKR annuels d'autres années", () => {
      const obj = makeObjective({
        time_target: "annual",
        target_year: currentYear - 1,
        title: "Ancien objectif",
        okr_key_results: [],
      });
      const result = buildOKRContext([obj]);
      expect(result).toContain("Ancien objectif");
    });

    it("affiche les métriques progression/confiance", () => {
      const obj = makeObjective({
        time_target: "S1",
        progress_percentage: 80,
        confidence_level: 90,
        okr_key_results: [],
      });
      const result = buildOKRContext([obj]);
      expect(result).toContain("progression: 80%");
      expect(result).toContain("confiance: 90%");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut si aucun OKR périodique", () => {
      expect(buildOKRContext([])).toBe("Aucun OKR periodique actif.");
    });

    it("filtre les OKR annuels de l'année en cours", () => {
      const annual = makeObjective({
        time_target: "annual",
        target_year: currentYear,
      });
      expect(buildOKRContext([annual])).toBe("Aucun OKR periodique actif.");
    });

    it("gère un KR sans target_value", () => {
      const kr = makeKeyResult({ target_value: null, progress_percentage: 33 });
      const obj = makeObjective({ time_target: "Q2", okr_key_results: [kr] });
      const result = buildOKRContext([obj]);
      expect(result).toContain("33%");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCRMContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCRMContext", () => {
  const col1 = makeColumn({ id: "col-1", name: "Prospection" });
  const col2 = makeColumn({ id: "col-2", name: "Négociation", position: 1 });

  describe("cas nominaux", () => {
    it("affiche le pipeline ouvert groupé par colonne", () => {
      const card = makeCard({
        column_id: "col-1",
        estimated_value: 5000,
        company: "Acme",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Pipeline ouvert");
      expect(result).toContain(`Prospection: 1 opportunite(s) (5${S}000€)`);
      expect(result).toContain("Acme");
      expect(result).toContain(`Total pipeline ouvert: 5${S}000€ (1 deals)`);
      // Negative: open deal must NOT appear in WON or LOST sections
      expect(result).toContain("Deals GAGNES: Aucun deal gagne");
      expect(result).not.toContain("Deals PERDUS (");
    });

    it("affiche les deals gagnés", () => {
      const card = makeCard({
        sales_status: "WON",
        estimated_value: 8000,
        company: "WinCo",
        service_type: "formation",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain(`Deals GAGNES (1 deals, total: 8${S}000€)`);
      expect(result).toContain("WinCo");
      // Negative: WON deal must NOT appear in open pipeline
      expect(result).toContain("Total pipeline ouvert: 0€ (0 deals)");
    });

    it("affiche les deals perdus avec raisons", () => {
      const card = makeCard({
        sales_status: "LOST",
        estimated_value: 3000,
        loss_reason: "prix",
        loss_reason_detail: "Trop cher",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain(`Deals PERDUS (1, total perdu: 3${S}000€)`);
      expect(result).toContain("Trop cher");
      expect(result).toContain("Repartition des raisons de perte");
      // Negative: LOST deal must NOT appear in open pipeline or WON
      expect(result).toContain("Total pipeline ouvert: 0€ (0 deals)");
      expect(result).toContain("Deals GAGNES: Aucun deal gagne");
    });

    it("affiche le pipeline pondéré par confiance", () => {
      const card = makeCard({
        estimated_value: 10000,
        confidence_score: 60,
      });
      const result = buildCRMContext([col1], [card]);
      // 10000 * 60% = 6000
      expect(result).toContain(`Pipeline pondere (confiance): 6${S}000€ (confiance moyenne: 60%)`);
    });

    it("affiche les deals à risque (confiance < 40%)", () => {
      const card = makeCard({
        estimated_value: 15000,
        confidence_score: 20,
        title: "Deal risqué",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Deals a risque (confiance < 40%)");
      expect(result).toContain(`Deal risqué`);
      expect(result).toContain(`15${S}000€`);
      expect(result).toContain("confiance: 20%");
    });

    it("affiche le taux de conversion", () => {
      const won = makeCard({ sales_status: "WON" });
      const lost = makeCard({ id: "c2", sales_status: "LOST" });
      const result = buildCRMContext([col1], [won, lost]);
      // Exact line verification to prevent partial match false positives
      expect(result).toContain("Taux de conversion: 50% (1 gagnes / 2 clotures)");
    });

    it("affiche la vélocité — délai moyen de closing", () => {
      const card = makeCard({
        sales_status: "WON",
        created_at: "2025-01-01T00:00:00Z",
        won_at: "2025-01-15T00:00:00Z",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Velocite commerciale");
      expect(result).toContain("Delai moyen de closing");
      expect(result).toContain("14 jours");
    });

    it("affiche la vélocité — délai moyen de perte", () => {
      const card = makeCard({
        sales_status: "LOST",
        created_at: "2025-03-01T00:00:00Z",
        lost_at: "2025-03-11T00:00:00Z",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Delai moyen de perte");
      expect(result).toContain("10 jours");
    });

    it("affiche l'alerte stagnation pour deals > 30 jours", () => {
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
      const card = makeCard({
        created_at: oldDate,
        title: "Vieux deal",
      });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("ALERTE STAGNATION");
      expect(result).toContain("Vieux deal");
    });

    it("affiche les sources d'acquisition", () => {
      const card = makeCard({ acquisition_source: "linkedin" });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Sources d'acquisition");
    });
  });

  describe("cas aux limites", () => {
    it("retourne 'Pipeline vide' sans cartes", () => {
      expect(buildCRMContext([col1], [])).toBe("Pipeline vide.");
    });

    it("gère des cartes avec valeur estimée à 0", () => {
      const card = makeCard({ estimated_value: 0 });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Pipeline ouvert");
      expect(result).toContain("Total pipeline ouvert: 0€ (1 deals)");
      // Negative: 0-value deal must not trigger "Deals a risque" even with low confidence
      expect(result).not.toContain("Deals a risque");
    });

    it("gère des cartes avec estimated_value null", () => {
      const card = makeCard({ estimated_value: null });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Total pipeline ouvert: 0€ (1 deals)");
    });

    it("gère une carte sans company", () => {
      const card = makeCard({ company: null });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Deal Alpha");
      expect(result).not.toContain("(null)");
    });

    it("gère une carte avec colonne inconnue", () => {
      const card = makeCard({ column_id: "col-unknown" });
      const result = buildCRMContext([col1], [card]);
      // Should still render without crashing
      expect(result).toContain("Pipeline ouvert");
    });

    it("n'affiche pas le pipeline pondéré sans confidence_score", () => {
      const card = makeCard({ estimated_value: 5000, confidence_score: null });
      const result = buildCRMContext([col1], [card]);
      expect(result).not.toContain("Pipeline pondere");
    });

    it("n'affiche pas 'Deals à risque' si confidence >= 40%", () => {
      const card = makeCard({ estimated_value: 5000, confidence_score: 50 });
      const result = buildCRMContext([col1], [card]);
      expect(result).not.toContain("Deals a risque");
    });

    it("n'affiche pas 'Deals à risque' si estimated_value = 0", () => {
      const card = makeCard({ estimated_value: 0, confidence_score: 10 });
      const result = buildCRMContext([col1], [card]);
      expect(result).not.toContain("Deals a risque");
    });

    it("n'affiche pas l'alerte stagnation pour deals < 30 jours", () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const card = makeCard({ created_at: recentDate });
      const result = buildCRMContext([col1], [card]);
      expect(result).not.toContain("ALERTE STAGNATION");
    });

    it("taux de conversion 0% quand seulement des deals ouverts", () => {
      const card = makeCard({ sales_status: "OPEN" });
      const result = buildCRMContext([col1], [card]);
      expect(result).toContain("Taux de conversion: 0% (0 gagnes / 0 clotures)");
    });

    it("gère une carte sans created_at", () => {
      const card = makeCard({ created_at: null as unknown as string });
      const result = buildCRMContext([col1], [card]);
      // Should not crash — daysInPipeline is null, no stagnation alert
      expect(result).toContain("Deal Alpha");
      expect(result).not.toContain("ALERTE STAGNATION");
      expect(result).not.toContain("dans le pipeline");
    });

    it("gère un grand nombre de cartes mixées", () => {
      const cards = [
        makeCard({ id: "c1", sales_status: "OPEN", estimated_value: 1000, column_id: "col-1" }),
        makeCard({ id: "c2", sales_status: "OPEN", estimated_value: 2000, column_id: "col-2" }),
        makeCard({ id: "c3", sales_status: "WON", estimated_value: 5000, won_at: "2025-02-01T00:00:00Z" }),
        makeCard({ id: "c4", sales_status: "LOST", estimated_value: 3000, loss_reason: "prix" }),
      ];
      const result = buildCRMContext([col1, col2], cards);
      expect(result).toContain("Prospection: 1 opportunite(s)");
      expect(result).toContain("Négociation: 1 opportunite(s)");
      expect(result).toContain("Deals GAGNES");
      expect(result).toContain("Deals PERDUS");
      expect(result).toContain("Taux de conversion: 50%");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildAcquisitionContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildAcquisitionContext", () => {
  describe("cas nominaux", () => {
    it("affiche le texte d'acquisition utilisateur", () => {
      const result = buildAcquisitionContext([], [], "Mon canal principal: LinkedIn");
      expect(result).toContain("Description de la structure d'acquisition");
      expect(result).toContain("Mon canal principal: LinkedIn");
    });

    it("affiche la répartition par type de service", () => {
      const cards = [
        makeCard({ service_type: "formation", sales_status: "OPEN", estimated_value: 2000 }),
        makeCard({ id: "c2", service_type: "mission", sales_status: "WON", estimated_value: 10000 }),
      ];
      const result = buildAcquisitionContext(cards, []);
      // Full lines to verify counts are correct
      expect(result).toContain("Formations: 1 total (1 en cours, 0 gagnes, 0 perdus)");
      expect(result).toContain("Missions: 1 total (0 en cours, 1 gagnes, 0 perdus)");
    });

    it("affiche le panier moyen des deals gagnés", () => {
      const cards = [
        makeCard({ id: "c1", sales_status: "WON", estimated_value: 5000 }),
        makeCard({ id: "c2", sales_status: "WON", estimated_value: 15000 }),
      ];
      const result = buildAcquisitionContext(cards, []);
      // (5000 + 15000) / 2 = 10000
      expect(result).toContain(`Panier moyen deals gagnes: 10${S}000€`);
    });

    it("affiche les top clients par valeur", () => {
      const cards = [
        makeCard({ id: "c1", company: "BigCo", estimated_value: 20000 }),
        makeCard({ id: "c2", company: "BigCo", estimated_value: 10000, sales_status: "WON" }),
        makeCard({ id: "c3", company: "SmallCo", estimated_value: 1000 }),
      ];
      const result = buildAcquisitionContext(cards, []);
      expect(result).toContain("Top clients par valeur");
      // BigCo: 2 opportunités, 1 gagné, 30000€ total
      expect(result).toContain(`bigco: 2 opportunites, 1 gagnes, 30${S}000€ total`);
      expect(result).toContain(`smallco: 1 opportunites, 0 gagnes, 1${S}000€ total`);
    });

    it("affiche la capacité de delivery", () => {
      const missions = [
        makeMission({ status: "in_progress", total_amount: 20000, consumed_amount: 5000 }),
        makeMission({ id: "m2", status: "completed", total_amount: 10000 }),
      ];
      const result = buildAcquisitionContext([], missions);
      expect(result).toContain("Capacite de delivery");
      expect(result).toContain("Missions actives: 1");
      expect(result).toContain("Missions terminees: 1");
      // 5000/20000 = 25% consumed
      expect(result).toContain(`Montant missions actives: 20${S}000€ (25% consomme)`);
    });

    it("affiche le taux de conversion par type", () => {
      const cards = [
        makeCard({ id: "c1", service_type: "formation", sales_status: "WON" }),
        makeCard({ id: "c2", service_type: "formation", sales_status: "LOST" }),
      ];
      const result = buildAcquisitionContext(cards, []);
      expect(result).toContain("Taux conversion: 50%");
    });
  });

  describe("cas aux limites", () => {
    it("gère aucune carte et aucune mission", () => {
      const result = buildAcquisitionContext([], []);
      expect(result).toContain("Analyse des donnees CRM");
      expect(result).toContain("Formations: 0 total");
      expect(result).toContain("Missions: 0 total");
    });

    it("ignore le texte d'acquisition vide", () => {
      const result = buildAcquisitionContext([], [], "  ");
      expect(result).not.toContain("Description de la structure d'acquisition");
    });

    it("affiche les cartes non classifiées", () => {
      const card = makeCard({ service_type: null });
      const result = buildAcquisitionContext([card], []);
      expect(result).toContain("Non classifie: 1 opportunites");
    });

    it("n'affiche pas le panier moyen sans deals gagnés", () => {
      const card = makeCard({ sales_status: "OPEN" });
      const result = buildAcquisitionContext([card], []);
      expect(result).not.toContain("Panier moyen");
    });

    it("gère les missions avec montants nuls", () => {
      const mission = makeMission({ total_amount: 0, consumed_amount: 0 });
      const result = buildAcquisitionContext([], [mission]);
      expect(result).toContain("0% consomme");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildRevenueTargetContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildRevenueTargetContext", () => {
  describe("cas nominaux", () => {
    it("affiche un objectif mensuel avec progression", () => {
      const target = makeRevenueTarget({
        period_type: "monthly",
        period_start: "2025-03-01",
        target_amount: 10000,
      });
      const wonCard = makeCard({
        sales_status: "WON",
        estimated_value: 4000,
        won_at: "2025-03-15T00:00:00Z",
      });
      const result = buildRevenueTargetContext([target], [wonCard]);
      expect(result).toContain("Objectifs de chiffre d'affaires");
      expect(result).toContain("40%");
    });

    it("affiche un objectif trimestriel avec label T", () => {
      const target = makeRevenueTarget({
        period_type: "quarterly",
        period_start: "2025-04-01",
        target_amount: 30000,
      });
      const result = buildRevenueTargetContext([target], []);
      expect(result).toContain("T2 2025");
    });

    it("affiche un objectif annuel", () => {
      const target = makeRevenueTarget({
        period_type: "annual",
        period_start: "2025-01-01",
        target_amount: 120000,
      });
      const result = buildRevenueTargetContext([target], []);
      expect(result).toContain("Annee 2025");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans objectifs", () => {
      const result = buildRevenueTargetContext([], []);
      expect(result).toContain("Aucun objectif de chiffre d'affaires defini");
    });

    it("gère un target_amount à 0 (division par zéro)", () => {
      const target = makeRevenueTarget({ target_amount: 0 });
      const result = buildRevenueTargetContext([target], []);
      expect(result).toContain("0%");
      // No crash
    });

    it("n'inclut pas les deals gagnés hors période", () => {
      const target = makeRevenueTarget({
        period_type: "monthly",
        period_start: "2025-03-01",
        target_amount: 10000,
      });
      // Won in February — outside the March period
      const wonCard = makeCard({
        sales_status: "WON",
        estimated_value: 5000,
        won_at: "2025-02-15T00:00:00Z",
      });
      const result = buildRevenueTargetContext([target], [wonCard]);
      expect(result).toContain("0%");
    });

    it("gère les deals sans won_at", () => {
      const target = makeRevenueTarget({
        period_type: "monthly",
        period_start: "2025-03-01",
        target_amount: 10000,
      });
      const wonCard = makeCard({
        sales_status: "WON",
        estimated_value: 5000,
        won_at: null,
      });
      const result = buildRevenueTargetContext([target], [wonCard]);
      expect(result).toContain("0%");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCalendarContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCalendarContext", () => {
  describe("cas nominaux", () => {
    it("affiche les événements à venir", () => {
      const events = [
        { summary: "RDV Client", start: "2025-03-10T14:00:00Z", end: "2025-03-10T15:00:00Z", allDay: false, attendees: ["jean@acme.com"] },
      ];
      const result = buildCalendarContext(events);
      expect(result).toContain("Agenda des 14 prochains jours");
      expect(result).toContain("1 evenements");
      expect(result).toContain("RDV Client");
      expect(result).toContain("jean@acme.com");
    });

    it("affiche 'journee entiere' pour un allDay event", () => {
      const events = [
        { summary: "Séminaire", start: "2025-03-10T00:00:00Z", end: "2025-03-11T00:00:00Z", allDay: true, attendees: [] },
      ];
      const result = buildCalendarContext(events);
      expect(result).toContain("journee entiere");
    });

    it("affiche plusieurs événements", () => {
      const events = [
        { summary: "Event 1", start: "2025-03-10T10:00:00Z", end: "2025-03-10T11:00:00Z", allDay: false, attendees: [] },
        { summary: "Event 2", start: "2025-03-11T14:00:00Z", end: "2025-03-11T15:00:00Z", allDay: false, attendees: ["a@b.com", "c@d.com"] },
      ];
      const result = buildCalendarContext(events);
      expect(result).toContain("2 evenements");
      expect(result).toContain("Event 1");
      expect(result).toContain("Event 2");
      expect(result).toContain("a@b.com, c@d.com");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans événements", () => {
      expect(buildCalendarContext([])).toBe("Aucun evenement a venir dans les 14 prochains jours.");
    });

    it("gère un événement sans participants", () => {
      const events = [
        { summary: "Solo", start: "2025-03-10T10:00:00Z", end: "2025-03-10T11:00:00Z", allDay: false, attendees: [] },
      ];
      const result = buildCalendarContext(events);
      expect(result).toContain("Solo");
      expect(result).not.toContain("avec:");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildMissionsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildMissionsContext", () => {
  describe("cas nominaux", () => {
    it("affiche les missions groupées par statut", () => {
      const missions = [
        makeMission({ status: "in_progress", title: "Mission A" }),
        makeMission({ id: "m2", status: "completed", title: "Mission B" }),
        makeMission({ id: "m3", status: "not_started", title: "Mission C" }),
      ];
      const result = buildMissionsContext(missions);
      expect(result).toContain("En cours: 1 mission(s)");
      expect(result).toContain("Mission A");
      expect(result).toContain("Terminee: 1 mission(s)");
      expect(result).toContain("Mission B");
      expect(result).toContain("A demarrer: 1 mission(s)");
      expect(result).toContain("Mission C");
    });

    it("affiche les montants des missions", () => {
      const mission = makeMission({ total_amount: 24000, consumed_amount: 8000, billed_amount: 6000 });
      const result = buildMissionsContext([mission]);
      expect(result).toContain(`Montant: 24${S}000€`);
      expect(result).toContain(`Consomme: 8${S}000€`);
      expect(result).toContain(`Facture: 6${S}000€`);
    });

    it("affiche le résumé des missions actives", () => {
      const missions = [
        makeMission({ status: "in_progress", total_amount: 20000, billed_amount: 5000 }),
        makeMission({ id: "m2", status: "not_started", total_amount: 10000, billed_amount: 0 }),
      ];
      const result = buildMissionsContext(missions);
      expect(result).toContain("Resume missions actives: 2 missions");
      expect(result).toContain(`montant total 30${S}000€`);
      expect(result).toContain(`facture 5${S}000€`);
    });
  });

  describe("cas aux limites", () => {
    it("retourne 'Aucune mission' si vide", () => {
      expect(buildMissionsContext([])).toBe("Aucune mission.");
    });

    it("gère une mission sans client_name", () => {
      const mission = makeMission({ client_name: null });
      const result = buildMissionsContext([mission]);
      expect(result).toContain("Mission Coaching");
      expect(result).not.toContain("(null)");
    });

    it("gère une mission sans montants", () => {
      const mission = makeMission({ total_amount: null, consumed_amount: null, billed_amount: null });
      const result = buildMissionsContext([mission]);
      expect(result).toContain("Mission Coaching");
    });

    it("gère le statut cancelled", () => {
      const mission = makeMission({ status: "cancelled", title: "Annulée" });
      const result = buildMissionsContext([mission]);
      expect(result).toContain("Annulee: 1 mission(s)");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildFormationsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildFormationsContext", () => {
  describe("cas nominaux", () => {
    it("affiche les formations planifiées et le catalogue", () => {
      const trainings = [
        { id: "t1", training_name: "React Avancé", client_name: "TechCo", start_date: "2025-04-01", end_date: "2025-04-02", sold_price_ht: 3500 },
      ];
      const catalogue = [
        { formation_name: "React Basics", prix: 2000, duree_heures: 14 },
      ];
      const result = buildFormationsContext(trainings, catalogue);
      expect(result).toContain("Formations planifiees (1)");
      expect(result).toContain("React Avancé");
      expect(result).toContain("TechCo");
      expect(result).toContain("Catalogue formations (1)");
      expect(result).toContain("React Basics");
      expect(result).toContain("14h");
    });
  });

  describe("cas aux limites", () => {
    it("affiche 'Aucune formation planifiee' sans trainings", () => {
      const result = buildFormationsContext([], []);
      expect(result).toContain("Aucune formation planifiee");
    });

    it("gère un training sans prix", () => {
      const trainings = [
        { id: "t1", training_name: "Test", client_name: "Co", start_date: "2025-04-01", end_date: null, sold_price_ht: null },
      ];
      const result = buildFormationsContext(trainings, []);
      expect(result).toContain("Test");
    });

    it("affiche 'prix libre' pour catalogue sans prix", () => {
      const catalogue = [{ formation_name: "Custom", prix: null, duree_heures: null }];
      const result = buildFormationsContext([], catalogue);
      expect(result).toContain("prix libre");
      expect(result).toContain("?h");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCrmCommentsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCrmCommentsContext", () => {
  const card = makeCard({ id: "card-1", title: "Deal Test", company: "TestCo" });

  describe("cas nominaux", () => {
    it("affiche les commentaires groupés par deal", () => {
      const comments = [
        { card_id: "card-1", author_email: "a@b.com", content: "Premier contact positif", created_at: "2025-02-01T10:00:00Z" },
        { card_id: "card-1", author_email: "a@b.com", content: "Relance effectuée", created_at: "2025-02-05T10:00:00Z" },
      ];
      const result = buildCrmCommentsContext(comments, [card]);
      expect(result).toContain("2 commentaires sur 1 deals");
      expect(result).toContain("Deal Test (TestCo)");
      expect(result).toContain("Premier contact positif");
      expect(result).toContain("Relance effectuée");
    });

    it("tronque les commentaires > 150 caractères", () => {
      const longContent = "A".repeat(200);
      const comments = [
        { card_id: "card-1", author_email: "a@b.com", content: longContent, created_at: "2025-02-01T10:00:00Z" },
      ];
      const result = buildCrmCommentsContext(comments, [card]);
      expect(result).toContain("...");
      expect(result).not.toContain("A".repeat(200));
    });

    it("limite à 3 commentaires par deal", () => {
      const comments = Array.from({ length: 5 }, (_, i) => ({
        card_id: "card-1",
        author_email: "a@b.com",
        content: `Comment ${i + 1}`,
        created_at: `2025-02-0${i + 1}T10:00:00Z`,
      }));
      const result = buildCrmCommentsContext(comments, [card]);
      expect(result).toContain("Comment 1");
      expect(result).toContain("Comment 3");
      expect(result).not.toContain("Comment 4");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans commentaires", () => {
      expect(buildCrmCommentsContext([], [card])).toBe("Aucun commentaire CRM enregistre.");
    });

    it("affiche l'ID si la carte est inconnue", () => {
      const comments = [
        { card_id: "unknown-id", author_email: "a@b.com", content: "test", created_at: "2025-02-01T10:00:00Z" },
      ];
      const result = buildCrmCommentsContext(comments, [card]);
      expect(result).toContain("unknown-id");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCrmEmailsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCrmEmailsContext", () => {
  const card = makeCard({ id: "card-1", title: "Deal Email", company: "MailCo" });

  describe("cas nominaux", () => {
    it("affiche les emails groupés par deal", () => {
      const emails = [
        { card_id: "card-1", sender_email: "me@co.com", recipient_email: "client@co.com", subject: "Proposition", sent_at: "2025-02-10T10:00:00Z" },
      ];
      const result = buildCrmEmailsContext(emails, [card]);
      expect(result).toContain("1 emails sur 1 deals");
      expect(result).toContain("Deal Email (MailCo)");
      expect(result).toContain("Proposition");
      expect(result).toContain("client@co.com");
    });

    it("affiche les statistiques de fréquence", () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      const emails = [
        { card_id: "card-1", sender_email: "me@co.com", recipient_email: "c@d.com", subject: "Test", sent_at: recent },
      ];
      const result = buildCrmEmailsContext(emails, [card]);
      expect(result).toContain("1 emails ces 7 derniers jours");
      expect(result).toContain("1 ces 30 derniers jours");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans emails", () => {
      expect(buildCrmEmailsContext([], [card])).toBe("Aucun email CRM enregistre.");
    });

    it("limite à 3 emails par deal", () => {
      const emails = Array.from({ length: 5 }, (_, i) => ({
        card_id: "card-1",
        sender_email: "me@co.com",
        recipient_email: "c@d.com",
        subject: `Email ${i + 1}`,
        sent_at: `2025-02-0${i + 1}T10:00:00Z`,
      }));
      const result = buildCrmEmailsContext(emails, [card]);
      expect(result).toContain("Email 1");
      expect(result).toContain("Email 3");
      expect(result).not.toContain("Email 4");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildTrainingEvaluationsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildTrainingEvaluationsContext", () => {
  describe("cas nominaux", () => {
    it("affiche la note moyenne et le taux de recommandation", () => {
      const evals = [
        { training_name: "React", appreciation_generale: 5, recommandation: "oui_avec_enthousiasme", message_recommandation: "Super formation!", amelioration_suggeree: null, company: "TechCo" },
        { training_name: "React", appreciation_generale: 4, recommandation: "oui", message_recommandation: null, amelioration_suggeree: "Plus d'exercices", company: null },
      ];
      const result = buildTrainingEvaluationsContext(evals);
      expect(result).toContain("2 evaluations");
      expect(result).toContain("Note moyenne: 4.5/5");
      expect(result).toContain("Taux de recommandation: 100%");
    });

    it("affiche les témoignages et améliorations par formation", () => {
      const evals = [
        { training_name: "Agile", appreciation_generale: 4, recommandation: "oui", message_recommandation: "Très pratique", amelioration_suggeree: "Ajouter un module Scrum", company: "ConsultCo" },
      ];
      const result = buildTrainingEvaluationsContext(evals);
      expect(result).toContain("Agile: 4.0/5");
      expect(result).toContain('"Très pratique"');
      expect(result).toContain("ConsultCo");
      expect(result).toContain('Amelioration: "Ajouter un module Scrum"');
    });

    it("affiche l'alerte non-recommandeurs", () => {
      const evals = [
        { training_name: "Test", appreciation_generale: 2, recommandation: "non", message_recommandation: null, amelioration_suggeree: null, company: null },
      ];
      const result = buildTrainingEvaluationsContext(evals);
      expect(result).toContain("1 participant(s) ne recommandent pas");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans évaluations", () => {
      expect(buildTrainingEvaluationsContext([])).toBe("Aucune evaluation de formation soumise.");
    });

    it("gère des évaluations sans note", () => {
      const evals = [
        { training_name: "Test", appreciation_generale: null, recommandation: "oui", message_recommandation: null, amelioration_suggeree: null, company: null },
      ];
      const result = buildTrainingEvaluationsContext(evals);
      expect(result).toContain("Note moyenne: —/5");
    });

    it("gère des évaluations sans recommandation", () => {
      const evals = [
        { training_name: "Test", appreciation_generale: 3, recommandation: null, message_recommandation: null, amelioration_suggeree: null, company: null },
      ];
      const result = buildTrainingEvaluationsContext(evals);
      expect(result).toContain("Taux de recommandation: 0%");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildSponsorEvaluationsContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildSponsorEvaluationsContext", () => {
  const baseSponsorEval = {
    training_name: "Leadership",
    sponsor_name: "Marie Dupont",
    company: "BigCorp",
    satisfaction_globale: 4,
    recommandation: "oui",
    message_recommandation: "Excellent programme",
    points_forts: "Qualité des intervenants",
    axes_amelioration: "Durée trop courte",
    impact_competences: "oui",
    objectifs_atteints: "oui",
  };

  describe("cas nominaux", () => {
    it("affiche la satisfaction et le taux de recommandation", () => {
      const result = buildSponsorEvaluationsContext([baseSponsorEval]);
      expect(result).toContain("1 evaluations");
      expect(result).toContain("Satisfaction moyenne: 4.0/5");
      expect(result).toContain("Taux de recommandation: 100%");
    });

    it("affiche l'impact compétences et objectifs", () => {
      const result = buildSponsorEvaluationsContext([baseSponsorEval]);
      expect(result).toContain("Impact competences valide par 1/1 sponsors");
      expect(result).toContain("Objectifs atteints pour 1/1 sponsors");
    });

    it("affiche le feedback individuel", () => {
      const result = buildSponsorEvaluationsContext([baseSponsorEval]);
      expect(result).toContain("Marie Dupont — BigCorp");
      expect(result).toContain("Leadership");
      expect(result).toContain("Qualité des intervenants");
      expect(result).toContain("Excellent programme");
      expect(result).toContain("Durée trop courte");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans évaluations", () => {
      expect(buildSponsorEvaluationsContext([])).toBe("Aucune evaluation commanditaire soumise.");
    });

    it("affiche 'Anonyme' si sponsor_name et company sont null", () => {
      const eval_ = { ...baseSponsorEval, sponsor_name: null, company: null };
      const result = buildSponsorEvaluationsContext([eval_]);
      expect(result).toContain("Anonyme");
    });

    it("gère des évaluations sans satisfaction_globale", () => {
      const eval_ = { ...baseSponsorEval, satisfaction_globale: null };
      const result = buildSponsorEvaluationsContext([eval_]);
      expect(result).toContain("Satisfaction moyenne: —/5");
    });

    it("limite à 5 évaluations individuelles", () => {
      const evals = Array.from({ length: 7 }, (_, i) => ({
        ...baseSponsorEval,
        sponsor_name: `Sponsor ${i + 1}`,
      }));
      const result = buildSponsorEvaluationsContext(evals);
      expect(result).toContain("Sponsor 1");
      expect(result).toContain("Sponsor 5");
      expect(result).not.toContain("Sponsor 6");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildMissionActivitiesContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildMissionActivitiesContext", () => {
  const baseActivity = {
    mission_title: "Mission Alpha",
    description: "Atelier cadrage",
    activity_date: "2025-02-10",
    duration: 1,
    duration_type: "days",
    billable_amount: 1200,
    is_billed: false,
  };

  describe("cas nominaux", () => {
    it("affiche le volume total et les montants", () => {
      const activities = [
        baseActivity,
        { ...baseActivity, description: "Coaching", duration: 4, duration_type: "hours", billable_amount: 600, is_billed: true },
      ];
      const result = buildMissionActivitiesContext(activities);
      expect(result).toContain("2 activites");
      expect(result).toContain("Volume: 1j + 4h");
      // 1200 + 600 = 1800 total, 600 billed
      expect(result).toContain(`Montant facturable: 1${S}800€ (dont 600€ facture)`);
    });

    it("affiche l'alerte de facturation en attente", () => {
      const activities = [
        { ...baseActivity, billable_amount: 2000, is_billed: false },
        { ...baseActivity, description: "Autre", billable_amount: 1000, is_billed: true },
      ];
      const result = buildMissionActivitiesContext(activities);
      // 3000 total - 1000 billed = 2000 pending
      expect(result).toContain(`2${S}000€ en attente de facturation`);
    });

    it("affiche les activités groupées par mission", () => {
      const activities = [
        baseActivity,
        { ...baseActivity, mission_title: "Mission Beta", description: "Audit" },
      ];
      const result = buildMissionActivitiesContext(activities);
      expect(result).toContain(`Mission Alpha: 1 activites, 1${S}200€`);
      expect(result).toContain(`Mission Beta: 1 activites, 1${S}200€`);
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans activités", () => {
      expect(buildMissionActivitiesContext([])).toBe("Aucune activite mission enregistree.");
    });

    it("gère des activités sans montant facturable", () => {
      const activity = { ...baseActivity, billable_amount: null };
      const result = buildMissionActivitiesContext([activity]);
      expect(result).toContain("Atelier cadrage");
    });

    it("n'affiche pas l'alerte si tout est facturé", () => {
      const activity = { ...baseActivity, is_billed: true };
      const result = buildMissionActivitiesContext([activity]);
      expect(result).not.toContain("en attente de facturation");
    });

    it("gère uniquement des heures (pas de jours)", () => {
      const activity = { ...baseActivity, duration: 8, duration_type: "hours" };
      const result = buildMissionActivitiesContext([activity]);
      expect(result).toContain("8h");
      expect(result).not.toContain("j +");
    });

    it("limite à 3 activités par mission", () => {
      const activities = Array.from({ length: 5 }, (_, i) => ({
        ...baseActivity,
        description: `Activite ${i + 1}`,
        activity_date: `2025-02-${String(i + 10).padStart(2, "0")}`,
      }));
      const result = buildMissionActivitiesContext(activities);
      expect(result).toContain("Activite 1");
      expect(result).toContain("Activite 3");
      expect(result).not.toContain("Activite 4");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildCrmActivityLogContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCrmActivityLogContext", () => {
  const card = makeCard({ id: "card-1", title: "Deal Log", company: "LogCo" });
  const baseLog = {
    card_id: "card-1",
    action_type: "card_created",
    old_value: null,
    new_value: null,
    created_at: new Date().toISOString(),
  };

  describe("cas nominaux", () => {
    it("affiche la répartition par type d'action", () => {
      const logs = [
        { ...baseLog, action_type: "card_created" },
        { ...baseLog, action_type: "card_moved", old_value: "Prospection", new_value: "Nego" },
        { ...baseLog, action_type: "card_moved", old_value: "Nego", new_value: "Closing" },
        { ...baseLog, action_type: "email_sent" },
      ];
      const result = buildCrmActivityLogContext(logs, [card]);
      expect(result).toContain("4 actions recentes");
      expect(result).toContain("Deplacements pipeline: 2");
      expect(result).toContain("Opportunites creees: 1");
      expect(result).toContain("Emails envoyes: 1");
    });

    it("affiche les derniers mouvements pipeline", () => {
      const logs = [
        { ...baseLog, action_type: "card_moved", old_value: "Prospection", new_value: "Nego" },
        { ...baseLog, action_type: "sales_status_changed", old_value: "OPEN", new_value: "WON" },
      ];
      const result = buildCrmActivityLogContext(logs, [card]);
      expect(result).toContain("Derniers mouvements pipeline");
      expect(result).toContain("Deal Log (LogCo)");
      expect(result).toContain("Prospection");
      expect(result).toContain("Nego");
    });

    it("affiche la cadence d'engagement", () => {
      const result = buildCrmActivityLogContext([baseLog], [card]);
      expect(result).toContain("Cadence:");
      expect(result).toContain("1 actions ces 7 derniers jours");
      expect(result).toContain("1 ces 30 derniers jours");
    });
  });

  describe("cas aux limites", () => {
    it("retourne message par défaut sans logs", () => {
      expect(buildCrmActivityLogContext([], [card])).toBe("Aucune activite CRM enregistree.");
    });

    it("affiche 'Deal inconnu' si la carte n'existe pas", () => {
      const log = { ...baseLog, card_id: "unknown", action_type: "card_moved", old_value: "A", new_value: "B" };
      const result = buildCrmActivityLogContext([log], [card]);
      expect(result).toContain("Deal inconnu");
    });

    it("utilise le action_type brut pour types inconnus", () => {
      const log = { ...baseLog, action_type: "custom_action" };
      const result = buildCrmActivityLogContext([log], [card]);
      expect(result).toContain("custom_action: 1");
    });

    it("gère les logs anciens (hors 7j et 30j)", () => {
      const oldLog = { ...baseLog, created_at: "2024-01-01T00:00:00Z" };
      const result = buildCrmActivityLogContext([oldLog], [card]);
      expect(result).toContain("0 actions ces 7 derniers jours");
      expect(result).toContain("0 ces 30 derniers jours");
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TESTS D'INTÉGRATION — interactions entre builders
// ═════════════════════════════════════════════════════════════════════════════

describe("intégration cross-module CRM", () => {
  it("les données CRM et acquisition sont cohérentes sur les mêmes cartes", () => {
    const cards = [
      makeCard({ id: "c1", sales_status: "OPEN", estimated_value: 5000, service_type: "formation", column_id: "col-1" }),
      makeCard({ id: "c2", sales_status: "WON", estimated_value: 10000, service_type: "mission", won_at: "2025-03-01T00:00:00Z" }),
      makeCard({ id: "c3", sales_status: "LOST", estimated_value: 3000, service_type: "formation", loss_reason: "prix" }),
    ];
    const col = makeColumn({ id: "col-1", name: "Pipeline" });

    const crmCtx = buildCRMContext([col], cards);
    const acqCtx = buildAcquisitionContext(cards, []);

    // CRM doit voir 1 open, 1 won, 1 lost
    expect(crmCtx).toContain("1 opportunite(s)");
    expect(crmCtx).toContain("Deals GAGNES (1 deals");
    expect(crmCtx).toContain("Deals PERDUS (1,");

    // Acquisition doit voir la même répartition
    expect(acqCtx).toContain("Formations: 2 total");
    expect(acqCtx).toContain("Missions: 1 total");
  });

  it("les objectifs de CA et les deals gagnés sont cohérents", () => {
    const target = makeRevenueTarget({
      period_type: "monthly",
      period_start: "2025-03-01",
      target_amount: 20000,
    });
    const wonCards = [
      makeCard({ id: "c1", sales_status: "WON", estimated_value: 8000, won_at: "2025-03-10T00:00:00Z" }),
      makeCard({ id: "c2", sales_status: "WON", estimated_value: 5000, won_at: "2025-03-20T00:00:00Z" }),
    ];

    const revenueCtx = buildRevenueTargetContext([target], wonCards);

    // 13000 / 20000 = 65%
    expect(revenueCtx).toContain(`13${S}000€`);
    expect(revenueCtx).toContain(`20${S}000€`);
    expect(revenueCtx).toContain("65%");
  });

  it("les missions et activités missions se complètent", () => {
    const missions = [
      makeMission({ status: "in_progress", title: "Mission X", total_amount: 30000, consumed_amount: 15000, billed_amount: 10000 }),
    ];
    const activities = [
      {
        mission_title: "Mission X",
        description: "Audit initial",
        activity_date: "2025-02-01",
        duration: 2,
        duration_type: "days",
        billable_amount: 2400,
        is_billed: true,
      },
      {
        mission_title: "Mission X",
        description: "Atelier transformation",
        activity_date: "2025-02-15",
        duration: 1,
        duration_type: "days",
        billable_amount: 1200,
        is_billed: false,
      },
    ];

    const missionsCtx = buildMissionsContext(missions);
    const activitiesCtx = buildMissionActivitiesContext(activities);

    // Missions shows the high-level view
    expect(missionsCtx).toContain("Mission X");
    expect(missionsCtx).toContain("Resume missions actives: 1 missions");

    // Activities shows the detail
    expect(activitiesCtx).toContain("Mission X: 2 activites");
    expect(activitiesCtx).toContain("Audit initial");
    expect(activitiesCtx).toContain("Atelier transformation");
    expect(activitiesCtx).toContain("en attente de facturation");
  });

  it("les commentaires et emails CRM complètent le pipeline", () => {
    const cards = [
      makeCard({ id: "c1", title: "Deal Important", company: "BigClient", sales_status: "OPEN", estimated_value: 50000 }),
    ];
    const comments = [
      { card_id: "c1", author_email: "me@co.com", content: "Client très intéressé, RDV semaine prochaine", created_at: "2025-02-20T10:00:00Z" },
    ];
    const emails = [
      { card_id: "c1", sender_email: "me@co.com", recipient_email: "client@bigclient.com", subject: "Proposition commerciale", sent_at: "2025-02-18T10:00:00Z" },
    ];

    const commentsCtx = buildCrmCommentsContext(comments, cards);
    const emailsCtx = buildCrmEmailsContext(emails, cards);

    expect(commentsCtx).toContain("Deal Important (BigClient)");
    expect(commentsCtx).toContain("Client très intéressé");
    expect(emailsCtx).toContain("Deal Important (BigClient)");
    expect(emailsCtx).toContain("Proposition commerciale");
  });

  it("les évaluations formations et sponsors enrichissent le même contexte", () => {
    const trainingEvals = [
      { training_name: "React Avancé", appreciation_generale: 5, recommandation: "oui_avec_enthousiasme", message_recommandation: "Très bien", amelioration_suggeree: null, company: "TechCo" },
      { training_name: "React Avancé", appreciation_generale: 4, recommandation: "oui", message_recommandation: null, amelioration_suggeree: null, company: "DevCo" },
    ];
    const sponsorEvals = [
      {
        training_name: "React Avancé",
        sponsor_name: "DRH",
        company: "TechCo",
        satisfaction_globale: 5,
        recommandation: "oui",
        message_recommandation: "Nos devs sont montés en compétence",
        points_forts: "Pédagogie",
        axes_amelioration: null,
        impact_competences: "oui",
        objectifs_atteints: "oui",
      },
    ];

    const trainCtx = buildTrainingEvaluationsContext(trainingEvals);
    const sponsorCtx = buildSponsorEvaluationsContext(sponsorEvals);

    // Both should reference the same formation
    expect(trainCtx).toContain("React Avancé");
    expect(sponsorCtx).toContain("React Avancé");

    // Training evals show participant view
    expect(trainCtx).toContain("Note moyenne: 4.5/5");
    expect(trainCtx).toContain("Taux de recommandation: 100%");

    // Sponsor evals show decision-maker view
    expect(sponsorCtx).toContain("Satisfaction moyenne: 5.0/5");
    expect(sponsorCtx).toContain("Impact competences valide par 1/1 sponsors");
  });

  it("scénario complet : pipeline vide + pas de missions = contextes dégradés cohérents (assertions exactes)", () => {
    const crmCtx = buildCRMContext([], []);
    const missionsCtx = buildMissionsContext([]);
    const acqCtx = buildAcquisitionContext([], []);
    const revenueCtx = buildRevenueTargetContext([], []);
    const calCtx = buildCalendarContext([]);
    const commentsCtx = buildCrmCommentsContext([], []);
    const emailsCtx = buildCrmEmailsContext([], []);
    const evalCtx = buildTrainingEvaluationsContext([]);
    const sponsorCtx = buildSponsorEvaluationsContext([]);
    const activitiesCtx = buildMissionActivitiesContext([]);
    const logCtx = buildCrmActivityLogContext([], []);
    const ambCtx = buildAmbitionContext([]);
    const okrCtx = buildOKRContext([]);

    // All should return graceful fallback messages, not crash
    expect(crmCtx).toBe("Pipeline vide.");
    expect(missionsCtx).toBe("Aucune mission.");
    expect(acqCtx).toContain("Analyse des donnees CRM");
    expect(revenueCtx).toContain("Aucun objectif");
    expect(calCtx).toContain("Aucun evenement");
    expect(commentsCtx).toContain("Aucun commentaire");
    expect(emailsCtx).toContain("Aucun email");
    expect(evalCtx).toContain("Aucune evaluation de formation");
    expect(sponsorCtx).toContain("Aucune evaluation commanditaire");
    expect(activitiesCtx).toContain("Aucune activite mission");
    expect(logCtx).toContain("Aucune activite CRM");
    expect(ambCtx).toContain("Aucune ambition");
    expect(okrCtx).toContain("Aucun OKR periodique");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STATUT CANCELED — angle mort identifié par l'audit
// ═════════════════════════════════════════════════════════════════════════════

describe("gestion du statut CANCELED", () => {
  const col1 = makeColumn();

  it("une carte CANCELED n'apparaît pas dans OPEN, WON, ni LOST", () => {
    const card = makeCard({ sales_status: "CANCELED", estimated_value: 5000 });
    const result = buildCRMContext([col1], [card]);
    expect(result).toContain("Total pipeline ouvert: 0€ (0 deals)");
    expect(result).toContain("Deals GAGNES: Aucun deal gagne");
    expect(result).not.toContain("Deals PERDUS (");
  });

  it("CANCELED n'est pas compté dans le taux de conversion", () => {
    const won = makeCard({ id: "c1", sales_status: "WON" });
    const canceled = makeCard({ id: "c2", sales_status: "CANCELED" });
    const result = buildCRMContext([col1], [won, canceled]);
    // Won=1, Lost=0, Canceled filtered out → winRate = 1/(1+0) = 100%
    expect(result).toContain("Taux de conversion: 100% (1 gagnes / 1 clotures)");
  });

  it("CANCELED avec service_type est compté dans les totaux par type dans buildAcquisitionContext", () => {
    // Documenter le comportement actuel : CANCELED est inclus car le filtre est par service_type, pas par sales_status
    const card = makeCard({ sales_status: "CANCELED", service_type: "formation", estimated_value: 3000 });
    const result = buildAcquisitionContext([card], []);
    // Le code filtre par service_type sans exclure CANCELED → la carte est comptée
    expect(result).toContain("Formations: 1 total");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BRANCHE "PERIODE EN COURS" — buildRevenueTargetContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildRevenueTargetContext — période en cours", () => {
  it("affiche le marqueur PERIODE EN COURS et le reste à réaliser", () => {
    // FIXED_NOW = 2025-03-15, donc mars 2025 est la période en cours
    const target = makeRevenueTarget({
      period_type: "monthly",
      period_start: "2025-03-01",
      target_amount: 20000,
    });
    const wonCard = makeCard({
      sales_status: "WON",
      estimated_value: 8000,
      won_at: "2025-03-10T00:00:00Z",
    });
    const result = buildRevenueTargetContext([target], [wonCard]);
    expect(result).toContain("PERIODE EN COURS");
    expect(result).toContain(`Reste 12${S}000€ a realiser en`);
    expect(result).toMatch(/en \d+ jours/);
  });

  it("n'affiche pas PERIODE EN COURS pour une période passée", () => {
    const target = makeRevenueTarget({
      period_type: "monthly",
      period_start: "2025-01-01",
      target_amount: 10000,
    });
    const result = buildRevenueTargetContext([target], []);
    expect(result).not.toContain("PERIODE EN COURS");
  });

  it("n'affiche pas 'Reste' quand l'objectif est dépassé", () => {
    const target = makeRevenueTarget({
      period_type: "monthly",
      period_start: "2025-03-01",
      target_amount: 5000,
    });
    const wonCard = makeCard({
      sales_status: "WON",
      estimated_value: 8000,
      won_at: "2025-03-10T00:00:00Z",
    });
    const result = buildRevenueTargetContext([target], [wonCard]);
    expect(result).toContain("PERIODE EN COURS");
    expect(result).not.toContain("Reste");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STAGNATION — vérification déterministe avec temps figé
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCRMContext — stagnation déterministe", () => {
  const col1 = makeColumn();

  it("affiche le nombre exact de jours de stagnation", () => {
    // FIXED_NOW = 2025-03-15, card created 2025-01-15 = 59 days ago
    const card = makeCard({ created_at: "2025-01-15T10:00:00Z", title: "Vieux deal" });
    const result = buildCRMContext([col1], [card]);
    expect(result).toContain("ALERTE STAGNATION");
    expect(result).toContain("59 jours");
    expect(result).toContain("Vieux deal");
  });

  it("n'affiche pas l'alerte à exactement 30 jours", () => {
    // 30 days before FIXED_NOW = 2025-02-13
    const card = makeCard({ created_at: "2025-02-13T12:00:00Z" });
    const result = buildCRMContext([col1], [card]);
    expect(result).not.toContain("ALERTE STAGNATION");
  });

  it("affiche l'alerte à 31 jours", () => {
    // 31 days before FIXED_NOW = 2025-02-12
    const card = makeCard({ created_at: "2025-02-12T12:00:00Z" });
    const result = buildCRMContext([col1], [card]);
    expect(result).toContain("ALERTE STAGNATION");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RATIOS DE CONVERSION NON-TRIVIAUX
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCRMContext — taux de conversion non-triviaux", () => {
  const col1 = makeColumn();

  it("calcule 75% avec 3 won / 1 lost", () => {
    const cards = [
      makeCard({ id: "c1", sales_status: "WON" }),
      makeCard({ id: "c2", sales_status: "WON" }),
      makeCard({ id: "c3", sales_status: "WON" }),
      makeCard({ id: "c4", sales_status: "LOST" }),
    ];
    const result = buildCRMContext([col1], cards);
    expect(result).toContain("Taux de conversion: 75%");
    expect(result).toContain("3 gagnes / 4 clotures");
  });

  it("calcule 33% avec 1 won / 2 lost", () => {
    const cards = [
      makeCard({ id: "c1", sales_status: "WON" }),
      makeCard({ id: "c2", sales_status: "LOST" }),
      makeCard({ id: "c3", sales_status: "LOST" }),
    ];
    const result = buildCRMContext([col1], cards);
    expect(result).toContain("Taux de conversion: 33%");
    expect(result).toContain("1 gagnes / 3 clotures");
  });

  it("calcule 100% avec uniquement des WON", () => {
    const cards = [
      makeCard({ id: "c1", sales_status: "WON" }),
      makeCard({ id: "c2", sales_status: "WON" }),
    ];
    const result = buildCRMContext([col1], cards);
    expect(result).toContain("Taux de conversion: 100%");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ORDRE DES SECTIONS — buildCRMContext
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCRMContext — ordre des sections", () => {
  it("les sections sont dans l'ordre correct : pipeline > won > lost > velocité > conversion", () => {
    const col1 = makeColumn();
    const cards = [
      makeCard({ id: "c1", sales_status: "OPEN", estimated_value: 1000 }),
      makeCard({ id: "c2", sales_status: "WON", estimated_value: 2000, won_at: "2025-03-01T00:00:00Z", created_at: "2025-02-01T00:00:00Z" }),
      makeCard({ id: "c3", sales_status: "LOST", estimated_value: 500, lost_at: "2025-03-01T00:00:00Z", created_at: "2025-02-15T00:00:00Z" }),
    ];
    const result = buildCRMContext([col1], cards);

    const pipelinePos = result.indexOf("Pipeline ouvert");
    const wonPos = result.indexOf("Deals GAGNES");
    const lostPos = result.indexOf("Deals PERDUS");
    const velocityPos = result.indexOf("Velocite commerciale");
    const conversionPos = result.indexOf("Metriques de conversion");

    expect(pipelinePos).toBeGreaterThan(-1);
    expect(wonPos).toBeGreaterThan(pipelinePos);
    expect(lostPos).toBeGreaterThan(wonPos);
    expect(velocityPos).toBeGreaterThan(lostPos);
    expect(conversionPos).toBeGreaterThan(velocityPos);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TEST DE VOLUME — 200+ cartes
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCRMContext — volume", () => {
  it("gère 200 cartes sans crash et avec métriques correctes", () => {
    const col1 = makeColumn({ id: "col-1", name: "Pipeline" });
    const col2 = makeColumn({ id: "col-2", name: "Nego" });
    const cards: CrmCard[] = Array.from({ length: 200 }, (_, i) =>
      makeCard({
        id: `c-${i}`,
        column_id: i % 2 === 0 ? "col-1" : "col-2",
        sales_status: i < 150 ? "OPEN" : i < 180 ? "WON" : "LOST",
        estimated_value: 1000,
        company: `Company ${i % 10}`,
        won_at: i >= 150 && i < 180 ? "2025-03-01T00:00:00Z" : null,
        lost_at: i >= 180 ? "2025-03-01T00:00:00Z" : null,
        created_at: "2025-03-01T00:00:00Z",
      }),
    );
    const result = buildCRMContext([col1, col2], cards);

    expect(result).toContain("150 deals"); // open count in total
    expect(result).toContain(`Deals GAGNES (30 deals, total: 30${S}000€)`);
    expect(result).toContain("Deals PERDUS (20,");
    // 30 / (30+20) = 60%
    expect(result).toContain("Taux de conversion: 60%");
    expect(result).toContain("30 gagnes / 50 clotures");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CADENCE EMAILS — déterministe avec temps figé
// ═════════════════════════════════════════════════════════════════════════════

describe("buildCrmEmailsContext — cadence déterministe", () => {
  const card = makeCard({ id: "card-1", title: "Deal", company: "Co" });

  it("distingue les emails des 7 derniers jours vs 30 derniers jours", () => {
    const emails = [
      // 2 days ago → dans 7j ET 30j
      { card_id: "card-1", sender_email: "me@co.com", recipient_email: "a@b.com", subject: "Recent", sent_at: "2025-03-13T10:00:00Z" },
      // 20 days ago → dans 30j mais PAS dans 7j
      { card_id: "card-1", sender_email: "me@co.com", recipient_email: "a@b.com", subject: "Older", sent_at: "2025-02-23T10:00:00Z" },
      // 60 days ago → ni l'un ni l'autre
      { card_id: "card-1", sender_email: "me@co.com", recipient_email: "a@b.com", subject: "Old", sent_at: "2025-01-14T10:00:00Z" },
    ];
    const result = buildCrmEmailsContext(emails, [card]);
    expect(result).toContain("Frequence: 1 emails ces 7 derniers jours, 2 ces 30 derniers jours.");
  });
});
