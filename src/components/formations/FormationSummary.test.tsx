import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FormationSummary from "./FormationSummary";

const config = { prix: 1000 } as never;

function renderSummary(props: Partial<React.ComponentProps<typeof FormationSummary>> = {}) {
  return render(
    <FormationSummary
      formationDemandee="Formation test"
      participants="a@b.c"
      typeSubrogation="sans"
      getSelectedFormationConfig={() => config}
      formationFormulas={[]}
      selectedFormulaId=""
      countParticipants={() => 2}
      {...props}
    />
  );
}

describe("FormationSummary", () => {
  it("affiche les frais de dossier pleins sans remise", () => {
    renderSummary();
    expect(screen.getByText(/Frais de dossier : 150€/)).toBeInTheDocument();
    expect(screen.getByText("2150€")).toBeInTheDocument();
    expect(screen.getByText("2150.00€")).toBeInTheDocument();
  });

  it("affiche la remise et le total réduit quand les frais sont offerts", () => {
    renderSummary({ offrirFraisAdmin: true });
    expect(screen.getByText(/− 150€ offerts/)).toBeInTheDocument();
    expect(screen.getByText("2000€")).toBeInTheDocument();
  });

  it("applique la remise sur les frais avec subrogation", () => {
    renderSummary({ typeSubrogation: "avec", offrirFraisAdmin: true });
    expect(screen.getByText(/Frais de dossier : 350€/)).toBeInTheDocument();
    expect(screen.getByText("200€")).toBeInTheDocument();
    expect(screen.getByText("2200€")).toBeInTheDocument();
  });

  it("ne rend rien sans formation", () => {
    const { container } = renderSummary({ formationDemandee: "" });
    expect(container.firstChild).toBeNull();
  });
});
