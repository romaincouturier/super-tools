import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SocialComposerDialog from "./SocialComposerDialog";
import type { SocialChannel } from "@/services/socialContents";

const h = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

const channel = (id: string, name: string, abbreviation: string, sort_order: number): SocialChannel => ({
  id, slug: id, name, abbreviation, text_limit: null, sort_order, is_active: true,
});

vi.mock("@/hooks/useSocialContents", () => ({
  useSocialChannels: () => ({
    data: [channel("li", "LinkedIn Romain", "LI", 10), channel("in", "Instagram", "IN", 40)],
    isLoading: false,
  }),
  useSocialGroup: () => ({ data: null, isFetching: false, isPending: false, isError: false }),
  useSaveSocialGroup: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("SocialComposerDialog : sauvegarde continue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue("id");
  });

  it("enregistre le brouillon quand on ferme sans cliquer sur Enregistrer", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Brouillon en cours" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    const draft = h.mutateAsync.mock.calls.at(-1)?.[0];
    expect(draft).toMatchObject({ channelIds: ["li"], commonText: "Brouillon en cours", sync: true, scheduledAt: null });
    expect(draft.groupId).toMatch(/^[0-9a-f-]{36}$/);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'enregistre rien tant qu'aucun canal n'est coché", async () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);

    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Sans canal" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    await new Promise((r) => setTimeout(r, 20));
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("enregistre au clic sur Enregistrer avec la date en heure de Paris, puis ferme", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Date (heure de Paris, facultative)"), { target: { value: "2026-01-15" } });
    expect(screen.getByLabelText("Heure")).toHaveValue("09:00");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ channelIds: ["li"], scheduledAt: "2026-01-15T08:00:00.000Z" });
  });
});
