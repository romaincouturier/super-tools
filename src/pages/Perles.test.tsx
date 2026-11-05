import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Perles from "./Perles";
import type { Pearl } from "@/services/pearls";

const h = vi.hoisted(() => ({
  pearls: [] as Pearl[],
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/hooks/usePearls", () => ({
  usePearls: () => ({ data: h.pearls, isLoading: false }),
  usePearlMutations: () => ({
    create: { mutate: h.create, isPending: false },
    update: { mutate: h.update, isPending: false },
    remove: { mutate: h.remove, isPending: false },
  }),
  usePearlLinkTargets: () => ({
    data: { missions: [{ id: "m1", title: "Mission Alpha" }], trainings: [{ id: "t1", training_name: "Facilitation graphique", start_date: null }] },
  }),
}));
vi.mock("@/components/ModuleLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/storageUrl", () => ({ getSignedUrl: vi.fn().mockResolvedValue(null) }));

const base: Pearl = {
  id: "1", title: null, message: "Merci pour la formation", message_fr: null, author_name: "Odile", author_company: null,
  is_anonymous: false, is_positive: true, pearl_date: "2026-11-02", pearl_time: null, source: "mail", image_path: null,
  gmail_thread_id: null, legacy_notion_id: null, archived: false, created_at: "", updated_at: "", created_by: null,
  mission_id: null, training_id: null, mission: null, training: null,
};

const renderPage = () => render(<MemoryRouter><Perles /></MemoryRouter>);

describe("page Perles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pearls = [
      { ...base, id: "p", title: "Une approche généreuse" },
      { ...base, id: "o", is_positive: false, message: "Question sur le CPF", author_name: "Florence" },
      { ...base, id: "a", archived: true, message: "Ancienne perle archivée" },
    ];
  });

  it("liste les perles non archivées et signale celles hors tableau de bord", () => {
    renderPage();
    expect(screen.getByText("Merci pour la formation")).toBeInTheDocument();
    expect(screen.getByText("Question sur le CPF")).toBeInTheDocument();
    expect(screen.queryByText("Ancienne perle archivée")).not.toBeInTheDocument();
    expect(screen.getAllByText("Hors tableau de bord")).toHaveLength(1);
    expect(screen.getByText(/2 perles\./)).toBeInTheDocument();
  });

  it("affiche les archivées quand on coche Archivées", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Archivées"));
    expect(screen.getByText("Ancienne perle archivée")).toBeInTheDocument();
  });

  it("filtre par recherche", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText("Rechercher"), { target: { value: "cpf" } });
    expect(screen.queryByText("Merci pour la formation")).not.toBeInTheDocument();
    expect(screen.getByText("Question sur le CPF")).toBeInTheDocument();
  });

  it("affiche les liens vers la mission et la formation rattachées", () => {
    h.pearls = [{ ...base, mission_id: "m1", training_id: "t1", mission: { title: "Mission Alpha" }, training: { training_name: "Facilitation graphique" } }];
    renderPage();
    expect(screen.getByRole("link", { name: "Mission : Mission Alpha" })).toHaveAttribute("href", "/missions/m1");
    expect(screen.getByRole("link", { name: "Formation : Facilitation graphique" })).toHaveAttribute("href", "/formations/t1");
  });

  it("archive une perle", () => {
    renderPage();
    const card = screen.getByText("Merci pour la formation").closest("div.space-y-2") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Archiver" }));
    expect(h.update).toHaveBeenCalledWith({ id: "p", input: { archived: true } }, expect.any(Object));
  });

  it("n'enregistre pas sans message", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle perle/ }));
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("crée une perle positive par défaut, sans lien", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle perle/ }));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "  Super formation  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.create).toHaveBeenCalledTimes(1);
    const { input, image } = h.create.mock.calls[0][0];
    expect(input).toMatchObject({ message: "Super formation", is_positive: true, is_anonymous: false, mission_id: null, training_id: null });
    expect(image).toBeNull();
  });

  it("crée une perle hors tableau de bord quand on décoche Positive", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle perle/ }));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Une question" } });
    fireEvent.click(screen.getByLabelText(/Positive/));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.create.mock.calls[0][0].input).toMatchObject({ is_positive: false });
  });

  it("modifie une perle existante avec ses valeurs préremplies", () => {
    renderPage();
    const card = screen.getByText("Question sur le CPF").closest("div.space-y-2") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[0]);
    expect(screen.getByLabelText("Message")).toHaveValue("Question sur le CPF");
    expect(screen.getByLabelText(/Positive/)).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.update.mock.calls.at(-1)![0]).toMatchObject({ id: "o", input: { is_positive: false, message: "Question sur le CPF" } });
  });
});
