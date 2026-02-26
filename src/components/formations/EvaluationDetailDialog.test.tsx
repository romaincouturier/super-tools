// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import EvaluationDetailDialog, { type EvaluationData } from "./EvaluationDetailDialog";

afterEach(cleanup);

// ── Mocks for radix/ui components ────────────────────────────────────────────

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Star: ({ className }: { className?: string }) => (
    <span data-testid="star" className={className}>★</span>
  ),
}));

// ── Test data ────────────────────────────────────────────────────────────────

const makeEvaluation = (overrides: Partial<EvaluationData> = {}): EvaluationData => ({
  id: "eval-1",
  first_name: "Jean",
  last_name: "Dupont",
  company: "Acme Corp",
  email: "jean@acme.fr",
  appreciation_generale: 4,
  recommandation: "oui_avec_enthousiasme",
  message_recommandation: "Excellente formation !",
  objectifs_evaluation: [
    { objectif: "Maîtriser React", niveau: 5 },
    { objectif: "Comprendre TypeScript", niveau: 3 },
  ],
  objectif_prioritaire: "Maîtriser React",
  delai_application: "cette_semaine",
  freins_application: null,
  rythme: "adapte",
  equilibre_theorie_pratique: "equilibre",
  amelioration_suggeree: null,
  conditions_info_satisfaisantes: true,
  formation_adaptee_public: true,
  qualification_intervenant_adequate: true,
  appreciations_prises_en_compte: "oui",
  consent_publication: true,
  remarques_libres: null,
  date_soumission: "2025-01-15T10:30:00Z",
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("EvaluationDetailDialog", () => {
  it("renders nothing when evaluation is null", () => {
    const { container } = render(
      <EvaluationDetailDialog open={true} onOpenChange={vi.fn()} evaluation={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when dialog is closed", () => {
    const { container } = render(
      <EvaluationDetailDialog
        open={false}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows participant display name and company in description", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation()}
        trainingName="React Avancé"
      />,
    );
    const description = screen.getByTestId("dialog-description");
    expect(description.textContent).toContain("Jean Dupont");
    expect(description.textContent).toContain("Acme Corp");
    expect(description.textContent).toContain("React Avancé");
  });

  it("shows 'Anonyme' when both names are null", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ first_name: null, last_name: null })}
      />,
    );
    const description = screen.getByTestId("dialog-description");
    expect(description.textContent).toContain("Anonyme");
  });

  it("displays email in participant info section", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation()}
      />,
    );
    expect(screen.getByText("jean@acme.fr")).toBeInTheDocument();
  });

  it("displays dash when email is absent", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ email: null })}
      />,
    );
    const allDashes = screen.getAllByText("—");
    expect(allDashes.length).toBeGreaterThanOrEqual(1);
  });

  it("displays appreciation rating as N/5", () => {
    // Use minimal data to avoid multiple "4/5" matches from objectifs
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({
          appreciation_generale: 4,
          objectifs_evaluation: [],
        })}
      />,
    );
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("renders star components for rating", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ appreciation_generale: 3, objectifs_evaluation: [] })}
      />,
    );
    const stars = screen.getAllByTestId("star");
    expect(stars.length).toBe(5); // 5 stars for appreciation only
  });

  it("displays recommandation badge with correct label", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({
          recommandation: "oui_avec_enthousiasme",
          objectifs_evaluation: [],
        })}
      />,
    );
    expect(screen.getByText("Recommande vivement")).toBeInTheDocument();
  });

  it("displays objectifs pédagogiques", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation()}
      />,
    );
    // "Maîtriser React" appears both in objectif list and objectif_prioritaire
    expect(screen.getAllByText("Maîtriser React").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Comprendre TypeScript")).toBeInTheDocument();
    // Check specific objectif ratings exist (5/5 and 3/5)
    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("displays objectif prioritaire", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({
          objectifs_evaluation: [{ objectif: "Test", niveau: 4 }],
          objectif_prioritaire: "Apprendre Vitest",
        })}
      />,
    );
    expect(screen.getByText("Apprendre Vitest")).toBeInTheDocument();
  });

  it("hides objectifs section when empty", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ objectifs_evaluation: [] })}
      />,
    );
    expect(screen.queryByText("Atteinte des objectifs pédagogiques")).not.toBeInTheDocument();
  });

  it("hides objectifs section when null", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ objectifs_evaluation: null })}
      />,
    );
    expect(screen.queryByText("Atteinte des objectifs pédagogiques")).not.toBeInTheDocument();
  });

  it("displays delai application label", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ delai_application: "3_mois" })}
      />,
    );
    expect(screen.getByText("Dans les 3 mois")).toBeInTheDocument();
  });

  it("displays rythme label with correct badge", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ rythme: "trop_rapide" })}
      />,
    );
    expect(screen.getByText("Trop rapide")).toBeInTheDocument();
  });

  it("displays equilibre label", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ equilibre_theorie_pratique: "trop_theorique" })}
      />,
    );
    expect(screen.getByText("Trop théorique")).toBeInTheDocument();
  });

  it("displays amelioration suggeree when present", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ amelioration_suggeree: "Plus de pratique" })}
      />,
    );
    expect(screen.getByText(/Plus de pratique/)).toBeInTheDocument();
  });

  it("displays Qualiopi compliance badges", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({
          conditions_info_satisfaisantes: true,
          formation_adaptee_public: false,
          qualification_intervenant_adequate: true,
          objectifs_evaluation: [],
        })}
      />,
    );
    const badges = screen.getAllByTestId("badge");
    const badgeTexts = badges.map((b) => b.textContent);
    expect(badgeTexts).toContain("Oui");
    expect(badgeTexts).toContain("Non");
  });

  it("displays appreciations prises en compte label", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ appreciations_prises_en_compte: "sans_objet" })}
      />,
    );
    expect(screen.getByText("Sans objet")).toBeInTheDocument();
  });

  it("displays message recommandation as testimonial", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ message_recommandation: "Super formation !" })}
      />,
    );
    expect(screen.getByText(/Super formation/)).toBeInTheDocument();
  });

  it("displays consent information", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ consent_publication: false })}
      />,
    );
    expect(screen.getByText("Ne consent pas à la publication")).toBeInTheDocument();
  });

  it("displays consent à la publication when true", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ consent_publication: true })}
      />,
    );
    expect(screen.getByText("Consent à la publication")).toBeInTheDocument();
  });

  it("hides consent line when consent_publication is null", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ consent_publication: null, message_recommandation: "test" })}
      />,
    );
    expect(screen.queryByText(/consent/i)).not.toBeInTheDocument();
  });

  it("displays remarques libres when present", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ remarques_libres: "Rien à signaler" })}
      />,
    );
    expect(screen.getByText(/Rien à signaler/)).toBeInTheDocument();
  });

  it("hides remarques section when absent", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ remarques_libres: null })}
      />,
    );
    expect(screen.queryByText("Remarques libres")).not.toBeInTheDocument();
  });

  it("hides testimonial section when message_recommandation is absent", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ message_recommandation: null })}
      />,
    );
    expect(screen.queryByText("Témoignage")).not.toBeInTheDocument();
  });

  it("handles freins_application display", () => {
    render(
      <EvaluationDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        evaluation={makeEvaluation({ freins_application: "Manque de temps" })}
      />,
    );
    expect(screen.getByText(/Manque de temps/)).toBeInTheDocument();
  });
});
