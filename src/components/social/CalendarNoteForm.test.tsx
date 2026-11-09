import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CalendarNoteForm, { type NoteFormTarget } from "./CalendarNoteForm";
import { maskText } from "@/lib/demoMask";
import { THEME_COLORS, type SocialCalendarNote } from "@/services/socialContents";

type Callbacks = { onSuccess?: () => void; onError?: (e: unknown) => void };

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  toastError: vi.fn(),
  demo: false,
  pending: { create: false, update: false, remove: false },
}));

vi.mock("@/hooks/useSocialContents", () => ({
  useCreateSocialNote: () => ({ mutate: h.create, isPending: h.pending.create }),
  useUpdateSocialNote: () => ({ mutate: h.update, isPending: h.pending.update }),
  useDeleteSocialNote: () => ({ mutate: h.remove, isPending: h.pending.remove }),
}));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/toastError", () => ({ toastError: h.toastError }));

const NOTE: SocialCalendarNote = { id: "n1", day: "2026-11-12", text: "Lancement AI4Product", color: "#f97316", created_at: "" };

const renderForm = (target: NoteFormTarget | null, onClose = vi.fn()) => {
  render(<CalendarNoteForm target={target} onClose={onClose} />);
  return onClose;
};

describe("CalendarNoteForm : ajout et édition (1.6-COMP-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.pending = { create: false, update: false, remove: false };
    [h.create, h.update, h.remove].forEach((m) => m.mockReset());
  });

  it("ajoute une note sur le jour choisi, avec le texte et la couleur", () => {
    h.create.mockImplementation((_v: unknown, cb: Callbacks) => cb.onSuccess?.());
    const onClose = renderForm({ day: "2026-11-12", note: null });
    expect(screen.getByText("Ajouter une note")).toBeInTheDocument();
    expect(screen.queryByLabelText("Jour")).toBeNull();
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Lancement AI4Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Couleur #f97316" }));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.create).toHaveBeenCalledWith(
      { day: "2026-11-12", text: "Lancement AI4Product", color: "#f97316" },
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("désactive Enregistrer pour un texte vide ou fait de blancs", () => {
    renderForm({ day: "2026-11-12", note: null });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "    " } });
    expect(save).toBeDisabled();
    fireEvent.submit(save.closest("form") as HTMLFormElement);
    expect(h.create).not.toHaveBeenCalled();
  });

  it("propose la première couleur de la palette des thèmes par défaut", () => {
    renderForm({ day: "2026-11-12", note: null });
    expect(screen.getByRole("button", { name: `Couleur ${THEME_COLORS[0]}` })).toHaveAttribute("aria-pressed", "true");
  });

  it("modifie le texte, la couleur et le jour d'une note existante", () => {
    h.update.mockImplementation((_v: unknown, cb: Callbacks) => cb.onSuccess?.());
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    expect(screen.getByText("Modifier la note")).toBeInTheDocument();
    expect(screen.getByLabelText("Texte")).toHaveValue("Lancement AI4Product");
    expect(screen.getByRole("button", { name: "Couleur #f97316" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Relance AI4Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Couleur #3b82f6" }));
    fireEvent.change(screen.getByLabelText("Jour"), { target: { value: "2026-11-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.update).toHaveBeenCalledWith(
      { id: "n1", day: "2026-11-14", text: "Relance AI4Product", color: "#3b82f6" },
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche l'erreur d'enregistrement en toast et garde le formulaire ouvert", () => {
    const err = new Error("refus");
    h.update.mockImplementation((_v: unknown, cb: Callbacks) => cb.onError?.(err));
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("transmet le jour enregistré à onSaved", () => {
    h.update.mockImplementation((_v: unknown, cb: Callbacks) => cb.onSuccess?.());
    const onSaved = vi.fn();
    render(<CalendarNoteForm target={{ day: NOTE.day, note: NOTE }} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("Jour"), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onSaved).toHaveBeenCalledWith("2026-12-15");
  });

  it("garde le formulaire ouvert et affiche un toast si la création échoue", () => {
    const err = new Error("refus");
    h.create.mockImplementation((_v: unknown, cb: Callbacks) => cb.onError?.(err));
    const onClose = renderForm({ day: "2026-11-12", note: null });
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Idée" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Texte")).toHaveValue("Idée");
  });

  it("compte la longueur en points de code et désactive Enregistrer au-delà de 500", () => {
    renderForm({ day: "2026-11-12", note: null });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "🚀".repeat(500) } });
    expect(screen.getByText("500/500")).toBeInTheDocument();
    expect(save).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "🚀".repeat(501) } });
    expect(screen.getByText("501/500")).toBeInTheDocument();
    expect(save).toBeDisabled();
    expect(screen.getByLabelText("Texte")).not.toHaveAttribute("maxlength");
  });

  it("désactive Enregistrer quand le jour est vidé ou invalide", () => {
    renderForm({ day: NOTE.day, note: NOTE });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    fireEvent.change(screen.getByLabelText("Jour"), { target: { value: "" } });
    expect(save).toBeDisabled();
    fireEvent.submit(save.closest("form") as HTMLFormElement);
    expect(h.update).not.toHaveBeenCalled();
  });

  it("repart d'un état neuf quand la cible passe d'une note à un ajout", () => {
    const { rerender } = render(<CalendarNoteForm target={{ day: NOTE.day, note: NOTE }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Texte")).toHaveValue("Lancement AI4Product");
    rerender(<CalendarNoteForm target={{ day: "2026-11-20", note: null }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Texte")).toHaveValue("");
    expect(screen.getByRole("button", { name: `Couleur ${THEME_COLORS[0]}` })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Jour")).toBeNull();
  });

  it("pendant l'envoi, Annuler et la fermeture du dialogue sont désactivés", () => {
    h.pending.update = true;
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    expect(screen.getByRole("button", { name: "Annuler" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText("Texte"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CalendarNoteForm en mode démo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = true;
    h.pending = { create: false, update: false, remove: false };
  });

  it("affiche le texte d'une note existante masqué, en lecture seule, sans enregistrement possible", () => {
    renderForm({ day: NOTE.day, note: NOTE });
    const field = screen.getByLabelText("Texte");
    expect(field).toHaveValue(maskText(NOTE.text));
    expect((field as HTMLTextAreaElement).value).not.toContain("Lancement");
    expect(field).toHaveAttribute("readonly");
    expect(screen.queryByDisplayValue("Lancement AI4Product")).toBeNull();
    fireEvent.change(field, { target: { value: "autre" } });
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(h.update).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeEnabled();
  });
});

describe("CalendarNoteForm : suppression confirmée (1.6-COMP-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.pending = { create: false, update: false, remove: false };
    h.remove.mockReset();
  });

  it("supprime après confirmation", async () => {
    h.remove.mockImplementation((_id: unknown, cb: Callbacks) => cb.onSuccess?.());
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Supprimer cette note ?")).toBeInTheDocument();
    expect(h.remove).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("n1", expect.anything()));
    expect(onClose).toHaveBeenCalled();
  });

  it("garde la note quand la confirmation est annulée", async () => {
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByText("Supprimer cette note ?")).toBeNull());
    expect(h.remove).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CalendarNoteForm : erreur de suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.pending = { create: false, update: false, remove: false };
  });

  it("garde le formulaire ouvert et affiche un toast si la suppression échoue", async () => {
    const err = new Error("refus");
    h.remove.mockImplementation((_id: unknown, cb: Callbacks) => cb.onError?.(err));
    const onClose = renderForm({ day: NOTE.day, note: NOTE });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await screen.findByText("Supprimer cette note ?");
    const buttons = screen.getAllByRole("button", { name: "Supprimer" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Modifier la note" })).toBeInTheDocument();
  });
});
