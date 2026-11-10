import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SocialComposerDialog from "./SocialComposerDialog";
import type { SocialChannel, SocialContentGroup, SocialPost } from "@/services/socialContents";

const h = vi.hoisted(() => {
  const state = {
    mutateAsync: vi.fn(), demo: false, group: null as unknown, themesPending: false, themesError: false,
    setPublished: vi.fn(), updatePublished: vi.fn(), deletePost: vi.fn(), deleteGroup: vi.fn(), validate: vi.fn(),
    refetch: vi.fn(),
  };
  state.refetch.mockImplementation(async () => ({ data: state.group }));
  return state;
});

// Radix Select en jsdom : défilement et capture de pointeur absents.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const channel = (id: string, name: string, abbreviation: string, sort_order: number): SocialChannel => ({
  id, slug: id, name, abbreviation, text_limit: null, sort_order, is_active: true,
});

vi.mock("@/hooks/useSocialContents", () => ({
  useSocialChannels: () => ({
    data: [channel("li", "LinkedIn Romain", "LI", 10), { ...channel("in", "Instagram", "IN", 40), text_limit: 10 }],
    isLoading: false,
  }),
  useSocialGroup: (id: string | null) => ({
    data: id ? h.group : undefined, isFetching: false, isPending: !id, isError: false,
    refetch: h.refetch,
  }),
  useSaveSocialGroup: () => ({ mutateAsync: h.mutateAsync, isPending: false }),
  useSetSocialPostPublished: () => ({ mutateAsync: h.setPublished }),
  useUpdatePublishedSocialPost: () => ({ mutateAsync: h.updatePublished }),
  useDeleteSocialPost: () => ({ mutateAsync: h.deletePost }),
  useDeleteSocialGroup: () => ({ mutateAsync: h.deleteGroup }),
  useValidateSocialContent: () => ({ mutateAsync: h.validate }),
  useProfileLabel: () => ({ data: "Romain" }),
  useNewsletterCards: () => ({ data: [{ id: "nl-1", title: "Newsletter de novembre" }], isError: false }),
  useSocialThemes: () => ({
    data: h.themesPending || h.themesError
      ? undefined
      : [{ id: "t-ia", name: "IA appliquée", color: "#3b82f6" }, { id: "t-fac", name: "Facilitation", color: "#22c55e" }],
    isPending: h.themesPending,
    isError: h.themesError,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useMedia", () => {
  const library = [
    { id: "img-1", file_name: "atelier-client.png", file_type: "image", file_url: "u1", source_label: "Mission", tags: [] },
    { id: "vid-1", file_name: "video.mp4", file_type: "video", file_url: "u2", source_label: "Mission", tags: [] },
  ];
  return {
    useMediaLibrary: () => ({ data: library, isLoading: false, isPending: false, isError: false }),
    useMediaByIds: (ids: string[]) => ({
      data: library.filter((m) => ids.includes(m.id)), isPending: false, isError: false, isPlaceholderData: false,
    }),
  };
});
vi.mock("@/components/media/MediaGrid", () => ({
  MediaThumb: ({ item }: { item: { file_name: string } }) => <img alt={item.file_name} />,
}));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));

const existing = (sync: boolean, posts: Partial<SocialPost>[]): SocialContentGroup => ({
  id: "g1", format: "post", sync, theme_id: null, created_by: null, created_at: "", updated_at: "",
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

  it("une date saisie laisse la déclinaison en Brouillon, enregistrée comme telle", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Date (heure de Paris, facultative)"), { target: { value: "2026-01-15" } });
    expect(screen.getByRole("combobox", { name: /^Statut/ })).toHaveTextContent("Brouillon");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ statuses: { li: "unscheduled" }, scheduledAt: "2026-01-15T08:00:00.000Z" });
  });

  it("refuse Programmé sans date et garde Brouillon", async () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.keyDown(screen.getByRole("combobox", { name: /^Statut/ }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Programmé" }), { key: "Enter" });
    expect(screen.getByRole("combobox", { name: /^Statut/ })).toHaveTextContent("Brouillon");
  });
});

describe("SocialComposerDialog : thème", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.group = null;
    h.themesPending = false;
    h.themesError = false;
    h.mutateAsync.mockResolvedValue("id");
  });

  const chooseTheme = (name: string) => {
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Thème" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("option", { name }), { key: "Enter" });
  };

  it("propose « Sans thème » par défaut et l'enregistre à null", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    expect(screen.getByRole("combobox", { name: "Thème" })).toHaveTextContent("Sans thème");
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ themeId: null });
  });

  it("envoie le thème choisi avec la sauvegarde, puis le retire", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    chooseTheme("IA appliquée");
    expect(screen.getByRole("combobox", { name: "Thème" })).toHaveTextContent("IA appliquée");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ channelIds: ["li"], themeId: "t-ia" });
  });

  it("n'affiche pas « Sans thème » tant que les thèmes chargent, et garde le thème du contenu", async () => {
    h.themesPending = true;
    h.group = { ...existing(true, [{ channel_id: "li" }]), theme_id: "t-fac" };
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    const select = screen.getByRole("combobox", { name: "Thème" });
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent("Chargement des thèmes...");
    expect(select).not.toHaveTextContent("Sans thème");
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Modifié" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ themeId: "t-fac" });
  });

  it("signale des thèmes indisponibles en cas d'erreur, sans « Sans thème »", () => {
    h.themesError = true;
    h.group = { ...existing(true, [{ channel_id: "li" }]), theme_id: "t-fac" };
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    const select = screen.getByRole("combobox", { name: "Thème" });
    expect(select).toBeDisabled();
    expect(select).toHaveTextContent("Thèmes indisponibles");
  });

  it("affiche « Sans thème » pour un thème inconnu et envoie son id, que la RPC ramène à null", async () => {
    h.group = { ...existing(true, [{ channel_id: "li" }]), theme_id: "t-supprime" };
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByRole("combobox", { name: "Thème" })).toHaveTextContent("Sans thème");
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Modifié" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ groupId: "g1", themeId: "t-supprime" });
  });

  it("reprend le thème d'un contenu existant", async () => {
    h.group = { ...existing(true, [{ channel_id: "li" }]), theme_id: "t-fac" };
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByRole("combobox", { name: "Thème" })).toHaveTextContent("Facilitation");
    chooseTheme("Sans thème");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ groupId: "g1", themeId: null });
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

  it("floute le texte du composeur en mode démo, sans altérer la valeur enregistrée", () => {
    h.demo = true;
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    expect(screen.getByLabelText("Texte")).toHaveStyle({ filter: "blur(4px)" });
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

describe("SocialComposerDialog : détail, marquage publié et suppression (story 1.5)", () => {
  const DATED = "2026-11-20T08:30:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.group = null;
    h.themesPending = false;
    h.themesError = false;
    h.mutateAsync.mockResolvedValue("id");
    h.setPublished.mockResolvedValue("published");
    h.updatePublished.mockResolvedValue(undefined);
    h.deletePost.mockResolvedValue(undefined);
    h.deleteGroup.mockResolvedValue(undefined);
  });

  const confirmIn = (name: string) =>
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name }));

  it("1.5-COMP-001 : ouvre le détail avec texte, visuel, canaux, thème, format, date et heure", () => {
    h.group = {
      ...existing(true, [
        { channel_id: "li", text: "Bonjour", media_id: "img-1", scheduled_at: DATED, publication_status: "scheduled" },
        { channel_id: "in", text: "Bonjour", media_id: "img-1", scheduled_at: DATED, publication_status: "scheduled" },
      ]),
      format: "story",
      theme_id: "t-fac",
    };
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByText("Modifier le contenu")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("data-state"))).toEqual(["checked", "checked"]);
    expect(screen.getByLabelText("Texte")).toHaveValue("Bonjour");
    expect(screen.getByTestId("social-visual-thumb")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Thème" })).toHaveTextContent("Facilitation");
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Story");
    expect(screen.getByLabelText("Date (heure de Paris, facultative)")).toHaveValue("2026-11-20");
    expect(screen.getByLabelText("Heure")).toHaveValue("09:30");
    expect(screen.getByTestId("social-declination-bar")).toHaveTextContent("Programmé");
  });

  it("marque la seule déclinaison de l'onglet, puis annule le marquage d'un second geste", async () => {
    h.group = existing(true, [
      { channel_id: "li", scheduled_at: DATED, publication_status: "scheduled" },
      { channel_id: "in", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    const { rerender } = render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    h.setPublished.mockImplementation(async () => {
      h.group = existing(true, [
        { channel_id: "li", scheduled_at: DATED, publication_status: "published" },
        { channel_id: "in", scheduled_at: DATED, publication_status: "scheduled" },
      ]);
      return "published";
    });
    fireEvent.click(screen.getByRole("button", { name: "Marquer publié" }));
    await waitFor(() => expect(h.setPublished).toHaveBeenCalledWith({ postId: "p0", published: true }));
    rerender(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(await screen.findByRole("button", { name: "Annuler le marquage" })).toBeEnabled();
    expect(screen.getByTestId("social-declination-bar")).toHaveTextContent("Publié, modifié seul");
    expect(screen.getAllByRole("checkbox")[0]).toBeDisabled();
    expect(screen.getAllByRole("checkbox")[1]).toBeEnabled();

    h.setPublished.mockImplementation(async () => {
      h.group = existing(true, [
        { channel_id: "li", scheduled_at: DATED, publication_status: "scheduled" },
        { channel_id: "in", scheduled_at: DATED, publication_status: "scheduled" },
      ]);
      return "scheduled";
    });
    fireEvent.click(screen.getByRole("button", { name: "Annuler le marquage" }));
    await waitFor(() => expect(h.setPublished).toHaveBeenLastCalledWith({ postId: "p0", published: false }));
    expect(h.setPublished).toHaveBeenCalledTimes(2);
  });

  it("désactive le marquage d'une déclinaison sans date, avec l'indication", () => {
    h.group = existing(true, [{ channel_id: "li" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByRole("button", { name: "Marquer publié" })).toBeDisabled();
    expect(screen.getByText("Planifiez une date pour marquer publié")).toBeInTheDocument();
  });

  it("édite seule une déclinaison publiée, synchro active, sans toucher au texte commun", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Publié", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByLabelText("Texte")).toHaveValue("Commun");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "LinkedIn Romain" }));
    expect(screen.getByLabelText("Texte LinkedIn Romain")).toHaveValue("Publié");
    expect(screen.getByText("Publié, modifié seul")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Texte LinkedIn Romain"), { target: { value: "Corrigé" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.updatePublished).toHaveBeenCalledWith({ postId: "p0", text: "Corrigé", mediaId: null }));
    expect(h.updatePublished).toHaveBeenCalledTimes(1);
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: true, commonText: "Commun" });
  });

  it("coupe la synchro sans écraser le texte propre d'une déclinaison publiée", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Publié", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: false, texts: { li: "Publié", in: "Commun" } });
    expect(h.updatePublished).not.toHaveBeenCalled();
  });

  it("1.5-COMP-002 : supprime la déclinaison de l'onglet après confirmation, et garde le contenu", async () => {
    h.group = existing(true, [{ channel_id: "li" }, { channel_id: "in" }]);
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId="g1" />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    confirmIn("Supprimer cette déclinaison");
    await waitFor(() => expect(h.deletePost).toHaveBeenCalledWith("p0"));
    expect(h.deleteGroup).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("tab", { name: "LinkedIn Romain" })).toBeNull());
    expect(screen.getByRole("tab", { name: "Instagram" })).toBeInTheDocument();
  });

  it("1.5-COMP-002 : ne supprime rien quand la confirmation est annulée", async () => {
    h.group = existing(true, [{ channel_id: "li" }, { channel_id: "in" }]);
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId="g1" />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    confirmIn("Annuler");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer tout le contenu" }));
    confirmIn("Annuler");
    await new Promise((r) => setTimeout(r, 20));
    expect(h.deletePost).not.toHaveBeenCalled();
    expect(h.deleteGroup).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "LinkedIn Romain" })).toBeInTheDocument();
  });

  it("1.5-COMP-002 : supprime tout le contenu après confirmation et ferme sans enregistrer", async () => {
    h.group = existing(true, [
      { channel_id: "li", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in" },
    ]);
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId="g1" />);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Saisie abandonnée" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer tout le contenu" }));
    confirmIn("Supprimer tout le contenu");
    await waitFor(() => expect(h.deleteGroup).toHaveBeenCalledWith("g1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.deletePost).not.toHaveBeenCalled();
    expect(h.mutateAsync).not.toHaveBeenCalled();
  });

  it("supprimer la dernière déclinaison supprime le contenu et ferme", async () => {
    h.group = existing(true, [{ channel_id: "li" }]);
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId="g1" />);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("supprime tout le contenu");
    confirmIn("Supprimer cette déclinaison");
    await waitFor(() => expect(h.deleteGroup).toHaveBeenCalledWith("g1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'offre pas la suppression du contenu tant qu'un nouveau contenu n'est pas enregistré", () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    expect(screen.queryByRole("button", { name: "Supprimer tout le contenu" })).toBeNull();
  });
});

describe("SocialComposerDialog : relecture story 1.5", () => {
  const DATED = "2026-11-20T08:30:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    h.demo = false;
    h.group = null;
    h.themesPending = false;
    h.themesError = false;
    h.mutateAsync.mockResolvedValue("id");
    h.setPublished.mockResolvedValue("published");
    h.updatePublished.mockResolvedValue(undefined);
    h.deletePost.mockResolvedValue(undefined);
    h.deleteGroup.mockResolvedValue(undefined);
  });

  const confirmIn = (name: string) =>
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name }));

  it("enregistre la saisie en attente, puis marque, puis relit, et affiche le texte relu", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Avant", scheduled_at: DATED, publication_status: "scheduled" },
      { channel_id: "in", text: "Avant", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "En attente" } });
    h.setPublished.mockImplementation(async () => {
      h.group = existing(true, [
        { channel_id: "li", text: "Texte du serveur", scheduled_at: DATED, publication_status: "published" },
        { channel_id: "in", text: "En attente", scheduled_at: DATED, publication_status: "scheduled" },
      ]);
      return "published";
    });
    fireEvent.click(screen.getByRole("button", { name: "Marquer publié" }));
    expect(await screen.findByLabelText("Texte LinkedIn Romain")).toHaveValue("Texte du serveur");
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ commonText: "En attente" });
    const saveAt = h.mutateAsync.mock.invocationCallOrder[0];
    const markAt = h.setPublished.mock.invocationCallOrder[0];
    expect(saveAt).toBeLessThan(markAt);
    expect(markAt).toBeLessThan(h.refetch.mock.invocationCallOrder.at(-1) as number);
    expect(h.updatePublished).not.toHaveBeenCalled();
  });

  it("annule le marquage synchro active sans divergence et réenregistre le groupe sur le commun", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Commun", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    h.setPublished.mockImplementation(async () => {
      h.group = existing(true, [
        { channel_id: "li", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
        { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
      ]);
      return "scheduled";
    });
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "LinkedIn Romain" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler le marquage" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(h.setPublished).toHaveBeenCalledWith({ postId: "p0", published: false });
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: true, commonText: "Commun", channelIds: ["li", "in"] });
  });

  it("demande confirmation pour annuler un marquage dont le texte propre diffère, et refuser ne change rien", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Corrigé", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "LinkedIn Romain" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler le marquage" }));
    expect(await screen.findByText("Reprendre le texte et le visuel communs ?")).toBeInTheDocument();
    confirmIn("Annuler");
    await new Promise((r) => setTimeout(r, 20));
    expect(h.setPublished).not.toHaveBeenCalled();
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Texte LinkedIn Romain")).toHaveValue("Corrigé");
  });

  it("désactive le marquage d'un canal coché non enregistré, même daté", () => {
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Date (heure de Paris, facultative)"), { target: { value: "2026-11-20" } });
    expect(screen.getByRole("button", { name: "Marquer publié" })).toBeDisabled();
    expect(screen.queryByText("Planifiez une date pour marquer publié")).toBeNull();
  });

  it("supprime la déclinaison du deuxième onglet et garde LinkedIn", async () => {
    h.group = existing(true, [{ channel_id: "li" }, { channel_id: "in" }]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    confirmIn("Supprimer cette déclinaison");
    await waitFor(() => expect(h.deletePost).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByRole("tab", { name: "Instagram" })).toBeNull());
    expect(screen.getByRole("tab", { name: "LinkedIn Romain" })).toBeInTheDocument();
    expect(h.deleteGroup).not.toHaveBeenCalled();
  });

  it("initialise la date depuis la première déclinaison non publiée datée", () => {
    h.group = existing(true, [
      { channel_id: "li", scheduled_at: "2026-11-20T08:30:00.000Z", publication_status: "published" },
      { channel_id: "in", scheduled_at: "2026-11-25T08:30:00.000Z", publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    expect(screen.getByLabelText("Date (heure de Paris, facultative)")).toHaveValue("2026-11-25");
  });

  it("supprime en base un nouveau contenu enregistré pendant la confirmation de suppression de sa dernière déclinaison", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Brouillon" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled(), { timeout: 2000 });
    const id = h.mutateAsync.mock.calls[0][0].groupId;
    confirmIn("Supprimer cette déclinaison");
    await waitFor(() => expect(h.deleteGroup).toHaveBeenCalledWith(id));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("ne crée rien en base pour supprimer la dernière déclinaison d'un contenu jamais enregistré", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Brouillon" } });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer cette déclinaison" }));
    confirmIn("Supprimer cette déclinaison");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(h.deleteGroup).not.toHaveBeenCalled();
  });

  it("propose la suppression du contenu après le premier enregistrement automatique, avec son id", async () => {
    const onOpenChange = vi.fn();
    render(<SocialComposerDialog open onOpenChange={onOpenChange} groupId={null} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Brouillon" } });
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer tout le contenu" }, { timeout: 2000 }));
    const id = h.mutateAsync.mock.calls[0][0].groupId;
    confirmIn("Supprimer tout le contenu");
    await waitFor(() => expect(h.deleteGroup).toHaveBeenCalledWith(id));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("réactive la synchro sans confirmation quand seule une publiée a un texte propre", async () => {
    h.group = existing(false, [
      { channel_id: "li", text: "Publié", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.queryByText("Réactiver le texte commun ?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls.at(-1)?.[0]).toMatchObject({ sync: true, commonText: "Commun", texts: { li: "Publié", in: "Commun" } });
    expect(h.updatePublished).not.toHaveBeenCalled();
  });

  it("relit le contenu au lieu d'échouer quand la déclinaison n'est plus publiée (22023)", async () => {
    h.group = existing(true, [
      { channel_id: "li", text: "Publié", scheduled_at: DATED, publication_status: "published" },
      { channel_id: "in", text: "Commun", scheduled_at: DATED, publication_status: "scheduled" },
    ]);
    h.updatePublished.mockRejectedValue({ code: "22023", message: "Seule une déclinaison publiée se modifie seule" });
    render(<SocialComposerDialog open onOpenChange={vi.fn()} groupId="g1" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "LinkedIn Romain" }));
    fireEvent.change(screen.getByLabelText("Texte LinkedIn Romain"), { target: { value: "Corrigé" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(h.refetch).toHaveBeenCalled());
    expect(h.updatePublished).toHaveBeenCalledTimes(1);
  });
});
