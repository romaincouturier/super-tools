import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SocialSettingsDialog, { nextThemeColor } from "./SocialSettingsDialog";
import { THEME_COLORS } from "@/services/socialContents";
import type { SocialTheme } from "@/services/socialContents";

type Callbacks = { onSuccess?: () => void; onError?: (e: unknown) => void };

const h = vi.hoisted(() => ({
  themes: [] as SocialTheme[],
  create: vi.fn(),
  update: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useSocialContents", () => ({
  useSocialThemes: () => ({ data: h.themes, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateSocialTheme: () => ({ mutate: h.create, isPending: false }),
  useUpdateSocialTheme: () => ({ mutate: h.update, mutateAsync: h.rename, isPending: false }),
  useDeleteSocialTheme: () => ({ mutate: h.remove, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/toastError", () => ({ toastError: h.toastError }));

const renderDialog = (onOpenChange = vi.fn()) => render(<SocialSettingsDialog open onOpenChange={onOpenChange} />);

describe("SocialSettingsDialog : thèmes (1.4-COMP-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.themes = [];
    [h.create, h.update, h.remove, h.rename].forEach((m) => m.mockReset());
    h.rename.mockResolvedValue(undefined);
  });

  it("invite à créer un thème quand la liste est vide, et crée avec la première couleur libre", () => {
    renderDialog();
    expect(screen.getByText(/Aucun thème pour l'instant/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajouter/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nom du nouveau thème"), { target: { value: "IA appliquée" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    expect(h.create).toHaveBeenCalledWith({ name: "IA appliquée", color: THEME_COLORS[0] }, expect.anything());
  });

  it("crée avec la couleur choisie et vide le champ après succès", () => {
    h.create.mockImplementation((_v: unknown, cb: Callbacks) => cb.onSuccess?.());
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Couleur du nouveau thème" }));
    fireEvent.click(screen.getByRole("button", { name: "Couleur #22c55e" }));
    const input = screen.getByLabelText("Nom du nouveau thème");
    fireEvent.change(input, { target: { value: "Facilitation" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(h.create).toHaveBeenCalledWith({ name: "Facilitation", color: "#22c55e" }, expect.anything());
    expect(input).toHaveValue("");
  });

  it("affiche en toast le refus d'un nom en double", () => {
    const err = new Error("Un thème porte déjà ce nom");
    h.create.mockImplementation((_v: unknown, cb: Callbacks) => cb.onError?.(err));
    renderDialog();
    fireEvent.change(screen.getByLabelText("Nom du nouveau thème"), { target: { value: "ia" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err);
  });

  it("renomme à la validation par Entrée", async () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    renderDialog();
    const input = screen.getByLabelText("Nom du thème IA");
    input.focus();
    fireEvent.change(input, { target: { value: "IA appliquée" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(h.rename).toHaveBeenCalledWith({ id: "t1", name: "IA appliquée" }));
    expect(h.rename).toHaveBeenCalledTimes(1);
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it("rétablit le nom et affiche l'erreur quand le renommage est refusé", async () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    const err = new Error("Un thème porte déjà ce nom");
    h.rename.mockRejectedValue(err);
    renderDialog();
    const input = screen.getByLabelText("Nom du thème IA");
    fireEvent.change(input, { target: { value: "Facilitation" } });
    fireEvent.blur(input);
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err));
    await waitFor(() => expect(input).toHaveValue("IA"));
  });

  it("n'enregistre rien quand le nom est inchangé à la perte du focus", () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    renderDialog();
    fireEvent.blur(screen.getByLabelText("Nom du thème IA"));
    expect(h.rename).not.toHaveBeenCalled();
  });

  it("Échap annule le renommage sans fermer le dialogue", () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    const input = screen.getByLabelText("Nom du thème IA");
    input.focus();
    fireEvent.change(input, { target: { value: "Brouillon de nom" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("IA");
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(h.rename).not.toHaveBeenCalled();
  });

  it("Échap hors d'un champ de renommage ferme le dialogue", () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    fireEvent.keyDown(screen.getByLabelText("Nom du nouveau thème"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("valide le renommage en cours à la fermeture du dialogue", async () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    const input = screen.getByLabelText("Nom du thème IA");
    input.focus();
    fireEvent.change(input, { target: { value: "IA appliquée" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(h.rename).toHaveBeenCalledWith({ id: "t1", name: "IA appliquée" }));
  });

  it("recolore un thème", () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Couleur du thème IA" }));
    fireEvent.click(screen.getByRole("button", { name: "Couleur #ef4444" }));
    expect(h.update).toHaveBeenCalledWith({ id: "t1", color: "#ef4444" }, expect.anything());
  });

  it("affiche l'erreur d'une recoloration refusée", () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    const err = new Error("refus");
    h.update.mockImplementation((_v: unknown, cb: Callbacks) => cb.onError?.(err));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Couleur du thème IA" }));
    fireEvent.click(screen.getByRole("button", { name: "Couleur #ef4444" }));
    expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err);
  });

  it("affiche l'erreur d'une suppression refusée", async () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    const err = new Error("refus");
    h.remove.mockImplementation((_id: unknown, cb: Callbacks) => cb.onError?.(err));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le thème IA" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith(expect.anything(), err));
  });

  it("supprime un thème après confirmation seulement", async () => {
    h.themes = [{ id: "t1", name: "IA", color: "#3b82f6" }];
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le thème IA" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Les contenus de ce thème sont conservés, sans thème.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(h.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer le thème IA" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("t1", expect.anything()));
  });

  it("propose la première couleur non utilisée", () => {
    expect(nextThemeColor([{ color: THEME_COLORS[0] }, { color: THEME_COLORS[1].toUpperCase() }])).toBe(THEME_COLORS[2]);
    expect(nextThemeColor(THEME_COLORS.map((color) => ({ color })))).toBe(THEME_COLORS[0]);
  });
});
