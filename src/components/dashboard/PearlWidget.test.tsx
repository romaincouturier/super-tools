import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PearlWidget from "./PearlWidget";
import type { Pearl } from "@/services/pearls";

const h = vi.hoisted(() => ({
  enabled: true,
  demo: false,
  pearl: null as Pearl | null,
  next: vi.fn(),
  loading: false,
}));

vi.mock("@/hooks/useDashboardPearlPreference", () => ({ useDashboardPearlPreference: () => ({ enabled: h.enabled }) }));
vi.mock("@/hooks/usePearls", () => ({ useRandomPearl: () => ({ pearl: h.pearl, next: h.next, loading: h.loading }) }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));

const pearl: Pearl = {
  id: "1", title: null, message: "Tu es le meilleur", message_fr: null, author_name: "Tobias", author_company: "Arturia",
  is_anonymous: false, is_positive: true, pearl_date: "2026-11-04", pearl_time: "08:34:00", source: "mail", image_path: null,
  gmail_thread_id: null, legacy_notion_id: null, archived: false, created_at: "", updated_at: "", created_by: null,
  mission_id: null, training_id: null, mission: null, training: null,
};

describe("PearlWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(h, { enabled: true, demo: false, pearl, loading: false });
  });

  it("ne s'affiche pas quand la préférence est désactivée", () => {
    h.enabled = false;
    const { container } = render(<PearlWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne s'affiche pas sans perle", () => {
    h.pearl = null;
    const { container } = render(<PearlWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le message, l'auteur, la date et l'heure", () => {
    render(<PearlWidget />);
    expect(screen.getByText(/Tu es le meilleur/)).toBeInTheDocument();
    expect(screen.getByText(/Tobias, Arturia · 4 novembre 2026 à 08:34/)).toBeInTheDocument();
  });

  it("n'expose jamais l'auteur d'une perle anonyme", () => {
    h.pearl = { ...pearl, is_anonymous: true };
    render(<PearlWidget />);
    expect(screen.getByText(/Anonyme · 4 novembre 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Tobias/)).not.toBeInTheDocument();
  });

  it("masque le message et l'auteur en mode démo", () => {
    h.demo = true;
    render(<PearlWidget />);
    expect(screen.queryByText(/Tu es le meilleur/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tobias/)).not.toBeInTheDocument();
  });

  it("demande une autre perle au clic", () => {
    render(<PearlWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Une autre perle" }));
    expect(h.next).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton pendant le chargement", () => {
    h.loading = true;
    render(<PearlWidget />);
    expect(screen.getByRole("button", { name: "Une autre perle" })).toBeDisabled();
  });
});
