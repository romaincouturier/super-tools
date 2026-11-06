import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SocialComposerDialog from "./SocialComposerDialog";
import type { SocialChannel, SocialContentGroup, SocialPost } from "@/services/socialContents";

const h = vi.hoisted(() => ({ mutateAsync: vi.fn(), demo: false, group: null as unknown }));

const channel = (id: string, name: string, abbreviation: string, sort_order: number): SocialChannel => ({
  id, slug: id, name, abbreviation, text_limit: null, sort_order, is_active: true,
});

vi.mock("@/hooks/useSocialContents", () => ({
  useSocialChannels: () => ({
    data: [channel("li", "LinkedIn Romain", "LI", 10), { ...channel("in", "Instagram", "IN", 40), text_limit: 10 }],
    isLoading: false,
  }),
  useSocialGroup: () => ({ data: h.group, isFetching: false, isPending: false, isError: false }),
  useSaveSocialGroup: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useMedia", () => ({
  useMediaLibrary: () => ({
    data: [
      { id: "img-1", file_name: "atelier-client.png", file_type: "image", file_url: "u1", source_label: "Mission", tags: [] },
      { id: "vid-1", file_name: "video.mp4", file_type: "video", file_url: "u2", source_label: "Mission", tags: [] },
    ],
    isLoading: false,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/components/media/MediaGrid", () => ({
  MediaThumb: ({ item }: { item: { file_name: string } }) => <img alt={item.file_name} />,
}));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));

const existing = (sync: boolean, posts: Partial<SocialPost>[]): SocialContentGroup => ({
  id: "g1", format: "post", sync, created_by: null, created_at: "", updated_at: "",
  posts: posts.map((p, i) => ({
    id: `p${i}`, group_id: "g1", channel_id: "li", text: "Texte", scheduled_at: null,
    publication_status: "unscheduled", media_id: null, ...p,
  })),
});

describe("SocialComposerDialog : sauvegarde continue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.group = null;
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

describe("SocialComposerDialog : visuel et alertes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.group = null;
    h.mutateAsync.mockResolvedValue("id");
  });

  it("envoie le visuel choisi dans la Médiathèque avec la sauvegarde", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    expect(screen.queryByRole("button", { name: "Choisir video.mp4" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choisir atelier-client.png" }));
    expect(screen.getByTestId("social-visual-thumb")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    const draft = h.mutateAsync.mock.calls.at(-1)?.[0];
    expect(draft).toMatchObject({ channelIds: ["li"], commonMediaId: "img-1", sync: true });
  });

  it("retire le visuel et affiche l'alerte de visuel manquant", () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByTestId("social-composer-alerts")).toHaveTextContent("LinkedIn Romain : Visuel manquant");
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    fireEvent.click(screen.getByRole("button", { name: "Choisir atelier-client.png" }));
    expect(screen.queryByTestId("social-composer-alerts")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(screen.getByTestId("social-composer-alerts")).toHaveTextContent("Visuel manquant");
  });

  it("signale en direct un texte trop long et laisse enregistrer", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Bien trop long" } });
    expect(screen.getByTestId("social-composer-alerts")).toHaveTextContent("Instagram : Visuel manquant, Texte trop long : 14 / 10 (+4)");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ channelIds: ["in"], commonText: "Bien trop long" });
  });

  it("masque les noms de fichiers du sélecteur en mode démo", () => {
    h.demo = true;
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    expect(screen.queryByText("atelier-client.png")).toBeNull();
    expect(screen.queryByAltText("atelier-client.png")).toBeNull();
    expect(screen.getByRole("button", { name: "Choisir ••••••••.png" })).toBeInTheDocument();
  });

  it("garde le visuel d'un contenu existant à la fermeture", async () => {
    h.group = existing(true, [{ channel_id: "li", media_id: "img-1" }, { channel_id: "in", media_id: "img-1" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByTestId("social-visual-thumb")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Modifié" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ groupId: "g1", sync: true, commonMediaId: "img-1" });
  });

  it("garde un visuel par canal quand la synchro est coupée", async () => {
    h.group = existing(false, [{ channel_id: "li", media_id: "img-1" }, { channel_id: "in", media_id: "img-2" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.change(screen.getByLabelText("Texte LinkedIn Romain"), { target: { value: "Modifié" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: false, mediaIds: { li: "img-1", in: "img-2" } });
  });

  it("recopie le visuel commun sur chaque canal quand on coupe la synchro", async () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    fireEvent.click(screen.getByRole("button", { name: "Choisir atelier-client.png" }));
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: false, mediaIds: { li: "img-1", in: "img-1" } });
  });

  it("demande confirmation pour réactiver la synchro quand seuls les visuels diffèrent", async () => {
    h.group = existing(false, [{ channel_id: "li", media_id: "img-1" }, { channel_id: "in", media_id: "img-2" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("Réactiver le texte commun ?")).toBeInTheDocument();
  });

  it("ne change que le canal de l'onglet quand la synchro est coupée", async () => {
    h.group = existing(false, [{ channel_id: "li", media_id: null }, { channel_id: "in", media_id: "img-2" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    fireEvent.click(screen.getByRole("button", { name: "Choisir atelier-client.png" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ mediaIds: { li: "img-1", in: "img-2" } });
  });

  it("n'alerte pas sur une déclinaison publiée sans visuel", () => {
    h.group = existing(true, [
      { channel_id: "li", media_id: null, publication_status: "published", scheduled_at: "2026-11-03T17:00:00.000Z" },
      { channel_id: "in", media_id: "img-1" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.queryByTestId("social-composer-alerts")).toBeNull();
  });

  it("signale un visuel manquant quand le média n'est plus dans la Médiathèque chargée", () => {
    h.group = existing(true, [{ channel_id: "li", media_id: "supprime" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByText("Visuel sélectionné")).toBeInTheDocument();
    expect(screen.getByTestId("social-composer-alerts")).toHaveTextContent("LinkedIn Romain : Visuel manquant");
  });

  it("en mode démo, ne montre jamais le vrai nom ni la source, et ne cherche pas sur le vrai nom", () => {
    h.demo = true;
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Choisir dans la Médiathèque/ }));
    expect(screen.queryByText("Mission")).toBeNull();
    fireEvent.change(screen.getByLabelText("Rechercher un visuel"), { target: { value: "atelier" } });
    expect(screen.getByText("Aucune image dans la Médiathèque.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Rechercher un visuel"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Choisir ••••••••.png" }));
    expect(screen.queryByText(/atelier-client/)).toBeNull();
    expect(screen.queryByAltText(/atelier-client/)).toBeNull();
    expect(screen.getByText("••••••••.png")).toBeInTheDocument();
  });
});
