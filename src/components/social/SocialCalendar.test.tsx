import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import SocialContentsPage from "@/pages/SocialContentsPage";
import type { SocialCalendarNote, SocialChannel, SocialContentGroup, SocialPost } from "@/services/socialContents";

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  rangeArgs: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  undatedError: false,
  instagramLimit: null as number | null,
  onDragEnd: null as null | ((e: unknown) => void),
  dated: [] as unknown[],
  themes: [] as unknown[],
  undated: [] as unknown[],
  notes: [] as SocialCalendarNote[],
  noteArgs: vi.fn(),
  noteMutate: vi.fn(),
  notesError: false,
  notesRefetch: vi.fn(),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  const Actual = actual.DndContext;
  return {
    ...actual,
    DndContext: (props: Parameters<typeof Actual>[0]) => {
      h.onDragEnd = props.onDragEnd as (e: unknown) => void;
      return <Actual {...props} />;
    },
  };
});

const channel = (id: string, name: string, abbreviation: string, sort_order: number): SocialChannel => ({
  id, slug: id, name, abbreviation, text_limit: null, sort_order, is_active: true,
});

vi.mock("@/hooks/useSocialContents", () => ({
  useSocialChannels: () => ({
    data: [channel("li", "LinkedIn Romain", "LI", 10), { ...channel("in", "Instagram", "IN", 40), text_limit: h.instagramLimit }],
    isLoading: false,
    isError: false,
    refetch: h.refetch,
  }),
  useSocialGroupsInRange: (fromIso: string, toIso: string) => {
    h.rangeArgs(fromIso, toIso);
    return { data: h.dated, isLoading: false, isError: false, refetch: h.refetch };
  },
  useUndatedSocialGroups: () => ({ data: h.undated, isLoading: false, isError: h.undatedError, refetch: h.refetch }),
  useSetSocialGroupDate: () => ({ mutate: h.mutate }),
  useSocialThemes: () => ({ data: h.themes }),
  useSocialCalendarNotes: (fromDay: string, toDay: string) => {
    h.noteArgs(fromDay, toDay);
    if (h.notesError) return { data: undefined, isLoading: false, isError: true, refetch: h.notesRefetch };
    return { data: h.notes.filter((n) => n.day >= fromDay && n.day <= toDay), isLoading: false, isError: false, refetch: h.notesRefetch };
  },
  useUpdateSocialNote: () => ({ mutate: h.noteMutate, isPending: false }),
  useCreateSocialNote: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteSocialNote: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/social/SocialSettingsDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="settings">Réglages ouverts</div> : null),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("@/components/ModuleLayout", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/social/SocialComposerDialog", () => ({
  default: ({ open, groupId }: { open: boolean; groupId: string | null }) =>
    open ? <div data-testid="composer">{groupId ?? "nouveau"}</div> : null,
}));

const post = (group_id: string, channel_id: string, text: string, scheduled_at: string | null): SocialPost => ({
  id: `${group_id}-${channel_id}`, group_id, channel_id, text, scheduled_at,
  publication_status: scheduled_at ? "scheduled" : "unscheduled", media_id: null,
});
const group = (id: string, posts: SocialPost[]): SocialContentGroup => ({
  id, format: "post", sync: true, theme_id: null, created_by: null, created_at: "", updated_at: "", posts,
});

const renderPage = () => render(<MemoryRouter><TooltipProvider><SocialContentsPage /></TooltipProvider></MemoryRouter>);

describe("Calendrier des contenus sociaux", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    vi.clearAllMocks();
    h.undatedError = false;
    h.instagramLimit = null;
    h.themes = [];
    h.notes = [];
    h.notesError = false;
    h.dated = [
      // 23:30 à Paris le 12 novembre (22:30 UTC).
      group("soir", [post("soir", "li", "Post du soir", "2026-11-12T22:30:00.000Z")]),
      // 18:00 à Paris le 3 novembre, Instagram seul.
      group("insta", [post("insta", "in", "Reel Instagram", "2026-11-03T17:00:00.000Z")]),
    ];
    h.undated = [
      group("brouillon", [post("brouillon", "li", "Idée", null), post("brouillon", "in", "Idée", null)]),
    ];
  });
  afterEach(() => { vi.useRealTimers(); });

  it("place les datés sur leur jour de Paris et compte les non datés", () => {
    renderPage();
    expect(within(screen.getByTestId("day-2026-11-12")).getByText("Post du soir")).toBeInTheDocument();
    expect(within(screen.getByTestId("day-2026-11-12")).getByText("23:30")).toBeInTheDocument();
    expect(within(screen.getByTestId("day-2026-11-13")).queryByText("Post du soir")).toBeNull();
    expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
    expect(screen.getByTestId("day-2026-11-20").textContent).toBe("20");
  });

  it("restreint la grille et Non planifiés aux réseaux sélectionnés, tous sans pastille", () => {
    renderPage();
    const linkedin = within(screen.getByRole("group", { name: "Réseau" })).getByRole("button", { name: "LinkedIn Romain" });
    expect(linkedin).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(linkedin);
    expect(linkedin).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Reel Instagram")).toBeNull();
    expect(screen.getByText("Post du soir")).toBeInTheDocument();
    expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
    expect(within(screen.getByTestId("social-card-brouillon")).queryByText("IN")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    expect(screen.getByText("Reel Instagram")).toBeInTheDocument();
    expect(within(screen.getByTestId("social-card-brouillon")).getByText("IN")).toBeInTheDocument();
    fireEvent.click(linkedin);
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    expect(screen.getByText("Post du soir")).toBeInTheDocument();
    expect(screen.getByText("Reel Instagram")).toBeInTheDocument();
  });

  it("filtre par thème et statut, dans la grille comme dans Non planifiés", () => {
    h.themes = [{ id: "ia", name: "IA appliquée", color: "#3b82f6" }, { id: "fac", name: "Facilitation", color: "#22c55e" }];
    h.dated = [
      { ...group("soir", [post("soir", "li", "Post du soir", "2026-11-12T22:30:00.000Z")]), theme_id: "ia" },
      { ...group("insta", [post("insta", "in", "Reel Instagram", "2026-11-03T17:00:00.000Z")]), theme_id: "fac" },
    ];
    h.undated = [
      { ...group("brouillon", [post("brouillon", "li", "Idée", null)]), theme_id: "ia" },
      group("sans", [post("sans", "li", "Sans thème", null)]),
    ];
    renderPage();
    const themesBar = screen.getByRole("group", { name: "Expertise" });
    fireEvent.click(within(themesBar).getByRole("button", { name: "IA appliquée" }));
    expect(screen.getByText("Post du soir")).toBeInTheDocument();
    expect(screen.queryByText("Reel Instagram")).toBeNull();
    expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
    expect(screen.queryByTestId("social-card-sans")).toBeNull();

    fireEvent.click(within(themesBar).getByRole("button", { name: "Facilitation" }));
    expect(screen.getByText("Reel Instagram")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("group", { name: "Statut" })).getByRole("button", { name: "Programmé" }));
    expect(screen.getByText("Non planifiés · 0")).toBeInTheDocument();
    expect(screen.getByText("Post du soir")).toBeInTheDocument();

    fireEvent.click(within(themesBar).getByRole("button", { name: "IA appliquée" }));
    fireEvent.click(within(themesBar).getByRole("button", { name: "Facilitation" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Statut" })).getByRole("button", { name: "Programmé" }));
    expect(screen.getByText("Non planifiés · 2")).toBeInTheDocument();
  });

  it("pastille Programmé : le brouillon quitte Non planifiés et une carte publiée datée est masquée", () => {
    h.dated = [
      group("prog", [post("prog", "li", "Programmé", "2026-11-12T08:00:00.000Z")]),
      group("pub", [{ ...post("pub", "li", "Déjà publié", "2026-11-13T08:00:00.000Z"), publication_status: "published" }]),
    ];
    renderPage();
    expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
    expect(screen.getByTestId("social-card-pub")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Statut" })).getByRole("button", { name: "Programmé" }));
    expect(screen.getByText("Non planifiés · 0")).toBeInTheDocument();
    expect(screen.queryByTestId("social-card-brouillon")).toBeNull();
    expect(screen.queryByTestId("social-card-pub")).toBeNull();
    expect(screen.getByTestId("social-card-prog")).toBeInTheDocument();
  });

  it("un thème sélectionné puis supprimé ne filtre plus : tous les contenus réapparaissent", () => {
    h.themes = [{ id: "ia", name: "IA appliquée", color: "#3b82f6" }];
    h.dated = [
      { ...group("soir", [post("soir", "li", "Post du soir", "2026-11-12T22:30:00.000Z")]), theme_id: "ia" },
      group("insta", [post("insta", "in", "Reel Instagram", "2026-11-03T17:00:00.000Z")]),
    ];
    const { rerender } = renderPage();
    fireEvent.click(within(screen.getByRole("group", { name: "Expertise" })).getByRole("button", { name: "IA appliquée" }));
    expect(screen.queryByText("Reel Instagram")).toBeNull();
    expect(screen.getByText("Non planifiés · 0")).toBeInTheDocument();
    h.themes = [];
    rerender(<MemoryRouter><TooltipProvider><SocialContentsPage /></TooltipProvider></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "Expertise" })).toBeNull();
    expect(screen.getByText("Reel Instagram")).toBeInTheDocument();
    expect(screen.getByText("Post du soir")).toBeInTheDocument();
    expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
  });

  it("borde la carte à la couleur de son thème, neutre sans thème", () => {
    h.themes = [{ id: "ia", name: "IA appliquée", color: "#3b82f6" }];
    h.dated = [{ ...group("soir", [post("soir", "li", "Post du soir", "2026-11-12T22:30:00.000Z")]), theme_id: "ia" }];
    h.undated = [
      { ...group("brouillon", [post("brouillon", "li", "Idée", null)]), theme_id: "ia" },
      // Thème supprimé entre-temps : liseré neutre.
      { ...group("orphelin", [post("orphelin", "li", "Orphelin", null)]), theme_id: "disparu" },
      group("sans", [post("sans", "li", "Sans thème", null)]),
    ];
    renderPage();
    expect(screen.getByTestId("social-card-soir")).toHaveStyle({ borderLeftColor: "#3b82f6" });
    expect(screen.getByTestId("social-card-brouillon")).toHaveStyle({ borderLeftColor: "#3b82f6" });
    expect(screen.getByTestId("social-card-orphelin").style.borderLeftColor).toBe("");
    expect(screen.getByTestId("social-card-sans").style.borderLeftColor).toBe("");
  });

  it("n'affiche pas la famille Thème tant qu'aucun thème n'existe, et ouvre les réglages", () => {
    renderPage();
    expect(screen.queryByRole("group", { name: "Expertise" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réglages" }));
    expect(screen.getByTestId("settings")).toBeInTheDocument();
  });

  it("affiche l'indicateur d'alerte sur une carte sans visuel, pas sur une carte complète", () => {
    h.dated = [
      group("sans", [post("sans", "li", "Sans visuel", "2026-11-12T08:00:00.000Z")]),
      group("avec", [{ ...post("avec", "li", "Avec visuel", "2026-11-13T08:00:00.000Z"), media_id: "m" }]),
    ];
    renderPage();
    expect(within(screen.getByTestId("social-card-sans")).getByRole("img", { name: "1 alerte : LinkedIn Romain : Visuel manquant" })).toBeInTheDocument();
    expect(within(screen.getByTestId("social-card-avec")).queryByTestId("social-alert-indicator")).toBeNull();
    expect(within(screen.getByTestId("social-card-brouillon")).getByRole("img", { name: /^2 alertes/ })).toBeInTheDocument();
  });

  it("applique la limite du canal : texte trop long malgré le visuel, deux alertes cumulées sur une déclinaison", () => {
    h.instagramLimit = 5;
    h.dated = [
      group("long", [{ ...post("long", "in", "Bien trop long", "2026-11-12T08:00:00.000Z"), media_id: "m" }]),
      group("double", [post("double", "in", "Encore trop long", "2026-11-13T08:00:00.000Z")]),
    ];
    renderPage();
    const long = within(screen.getByTestId("social-card-long")).getByTestId("social-alert-indicator");
    expect(long).toHaveAttribute("aria-label", "1 alerte : Instagram : Texte trop long : 14 / 5 (+9)");
    expect(long).toHaveAttribute("tabindex", "0");
    expect(within(screen.getByTestId("social-card-double")).getByRole("img", {
      name: "2 alertes : Instagram : Visuel manquant, Texte trop long : 16 / 5 (+11)",
    })).toBeInTheDocument();
  });

  it("n'affiche pas d'alerte pour une déclinaison publiée sans visuel", () => {
    h.dated = [group("pub", [{ ...post("pub", "li", "Publié", "2026-11-12T08:00:00.000Z"), publication_status: "published" }])];
    renderPage();
    expect(within(screen.getByTestId("social-card-pub")).queryByTestId("social-alert-indicator")).toBeNull();
  });

  it("ouvre le composeur sur le contenu cliqué", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("social-card-soir"));
    expect(screen.getByTestId("composer")).toHaveTextContent("soir");
  });

  it("dépose un brouillon à 09:00 et déplace un daté en gardant son heure", () => {
    renderPage();
    const brouillon = h.undated[0] as SocialContentGroup;
    h.onDragEnd?.({
      active: { id: "brouillon", data: { current: { card: { group: brouillon, posts: brouillon.posts, status: "unscheduled", scheduledAt: null } } } },
      over: { id: "day:2026-11-12" },
    });
    expect(h.mutate).toHaveBeenLastCalledWith({ groupId: "brouillon", scheduledAt: "2026-11-12T08:00:00.000Z" }, expect.anything());

    const insta = h.dated[1] as SocialContentGroup;
    h.onDragEnd?.({
      active: { id: "insta", data: { current: { card: { group: insta, posts: insta.posts, status: "scheduled", scheduledAt: "2026-11-03T17:00:00.000Z" } } } },
      over: { id: "day:2026-11-10" },
    });
    expect(h.mutate).toHaveBeenLastCalledWith({ groupId: "insta", scheduledAt: "2026-11-10T17:00:00.000Z" }, expect.anything());
  });

  it("refuse le dépôt d'un contenu entièrement publié, avec un message", () => {
    renderPage();
    const published = group("pub", [{ ...post("pub", "li", "Publié", "2026-11-03T17:00:00.000Z"), publication_status: "published" }]);
    h.onDragEnd?.({
      active: { id: "pub", data: { current: { card: { group: published, posts: published.posts, status: "published", scheduledAt: "2026-11-03T17:00:00.000Z" } } } },
      over: { id: "day:2026-11-10" },
    });
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Un contenu publié ne se déplace pas" }));
  });

  it("déplace un contenu partiellement publié depuis la date et l'heure de sa déclinaison non publiée", () => {
    h.dated = [group("mixte", [
      { ...post("mixte", "li", "Publié", "2026-11-03T17:00:00.000Z"), publication_status: "published" },
      post("mixte", "in", "Programmé", "2026-11-12T08:15:00.000Z"),
    ])];
    renderPage();
    expect(within(screen.getByTestId("day-2026-11-12")).getByTestId("social-card-mixte")).toBeInTheDocument();
    const mixte = h.dated[0] as SocialContentGroup;
    h.onDragEnd?.({
      active: { id: "mixte", data: { current: { card: { group: mixte, posts: mixte.posts, status: "scheduled", scheduledAt: "2026-11-12T08:15:00.000Z" } } } },
      over: { id: "day:2026-11-14" },
    });
    expect(h.mutate).toHaveBeenLastCalledWith({ groupId: "mixte", scheduledAt: "2026-11-14T08:15:00.000Z" }, expect.anything());
  });

  it("ne réécrit rien quand une carte est déposée sur son propre jour", () => {
    renderPage();
    const insta = h.dated[1] as SocialContentGroup;
    h.onDragEnd?.({
      // Format renvoyé par la base, différent de celui que produit moveKeepingTime.
      active: { id: "insta", data: { current: { card: { group: insta, posts: insta.posts, status: "scheduled", scheduledAt: "2026-11-03T17:00:00+00:00" } } } },
      over: { id: "day:2026-11-03" },
    });
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it("charge la plage de la grille du mois, puis celle du mois suivant", () => {
    renderPage();
    // Novembre 2026 : du lundi 26 octobre au dimanche 6 décembre, minuit à Paris (heure d'hiver).
    expect(h.rangeArgs).toHaveBeenLastCalledWith("2026-10-25T23:00:00.000Z", "2026-12-06T23:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(h.rangeArgs).toHaveBeenLastCalledWith("2026-11-29T23:00:00.000Z", "2027-01-03T23:00:00.000Z");
  });

  it("charge la plage de la semaine, puis celle de la semaine suivante", () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: "Semaine" }));
    // Semaine du 5 novembre : lundi 2 au dimanche 8.
    expect(h.rangeArgs).toHaveBeenLastCalledWith("2026-11-01T23:00:00.000Z", "2026-11-08T23:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(h.rangeArgs).toHaveBeenLastCalledWith("2026-11-08T23:00:00.000Z", "2026-11-15T23:00:00.000Z");
  });

  it("affiche une erreur avec Réessayer au lieu d'un calendrier vide", () => {
    h.undatedError = true;
    renderPage();
    expect(screen.queryByText(/Non planifiés/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  describe("notes du calendrier (story 1.6)", () => {
    const note = (id: string, day: string, text: string, color = "#f97316"): SocialCalendarNote => ({
      id, day, text, color, created_at: "2026-11-01T00:00:00Z",
    });

    it("affiche la note sur son jour, au-dessus des cartes, sans statut ni canal", () => {
      h.notes = [note("n1", "2026-11-12", "Lancement AI4Product")];
      renderPage();
      const day = screen.getByTestId("day-2026-11-12");
      const noteEl = within(day).getByTestId("social-note-n1");
      expect(noteEl).toHaveTextContent("Lancement AI4Product");
      expect(noteEl.compareDocumentPosition(within(day).getByTestId("social-card-soir")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const card = within(day).getByTestId("social-card-soir");
      // Mêmes sélecteurs que la carte, qui elle porte pastille de statut et badge canal.
      expect(within(card).getByRole("img", { name: "Programmé" })).toBeInTheDocument();
      expect(within(card).getByText("LI")).toBeInTheDocument();
      expect(within(noteEl).queryByRole("img", { name: /Brouillon|Programmé|Publié/ })).toBeNull();
      expect(within(noteEl).queryByText("LI")).toBeNull();
      expect(noteEl.querySelector(".rounded-full")).toBeNull();
      expect(noteEl.style.backgroundColor).not.toBe("");
    });

    it("lit les notes de la plage de la grille et n'affiche pas celles hors plage", () => {
      h.notes = [note("n1", "2026-11-12", "Dans le mois"), note("n2", "2026-12-15", "Mois suivant")];
      renderPage();
      expect(h.noteArgs).toHaveBeenLastCalledWith("2026-10-26", "2026-12-06");
      expect(screen.getByText("Dans le mois")).toBeInTheDocument();
      expect(screen.queryByText("Mois suivant")).toBeNull();
    });

    it("1.6-UNIT-001 : les notes restent visibles quels que soient les filtres et ne comptent pas dans Non planifiés", () => {
      h.themes = [{ id: "ia", name: "IA appliquée", color: "#3b82f6" }];
      h.notes = [note("n1", "2026-11-12", "Lancement"), note("n2", "2026-11-20", "Relance")];
      renderPage();
      expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole("group", { name: "Statut" })).getByRole("button", { name: "Programmé" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Expertise" })).getByRole("button", { name: "IA appliquée" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Réseau" })).getByRole("button", { name: "Instagram" }));
      expect(screen.queryByText("Post du soir")).toBeNull();
      expect(screen.getByTestId("social-note-n1")).toBeInTheDocument();
      expect(screen.getByTestId("social-note-n2")).toBeInTheDocument();
      expect(screen.getByText("Non planifiés · 0")).toBeInTheDocument();
    });

    it("ouvre le formulaire d'ajout depuis un jour, et d'édition au clic sur une note", () => {
      h.notes = [note("n1", "2026-11-12", "Lancement")];
      renderPage();
      fireEvent.click(within(screen.getByTestId("day-2026-11-14")).getByRole("button", { name: /Ajouter une note/ }));
      expect(screen.getByRole("dialog", { name: "Ajouter une note" })).toBeInTheDocument();
      expect(screen.queryByTestId("composer")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
      fireEvent.click(screen.getByTestId("social-note-n1"));
      expect(screen.getByRole("dialog", { name: "Modifier la note" })).toBeInTheDocument();
      expect(screen.getByLabelText("Jour")).toHaveValue("2026-11-12");
      expect(screen.queryByTestId("composer")).toBeNull();
    });

    it("1.6-SQL-001 côté front : en TZ=UTC, les notes du 29 et du 30 mars 2026 restent chacune dans leur cellule", () => {
      vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
      h.dated = [];
      h.notes = [note("dst", "2026-03-29", "Changement d'heure"), note("lendemain", "2026-03-30", "Lendemain")];
      renderPage();
      expect(within(screen.getByTestId("day-2026-03-29")).getByTestId("social-note-dst")).toBeInTheDocument();
      expect(within(screen.getByTestId("day-2026-03-29")).queryByTestId("social-note-lendemain")).toBeNull();
      expect(within(screen.getByTestId("day-2026-03-30")).getByTestId("social-note-lendemain")).toBeInTheDocument();
      expect(within(screen.getByTestId("day-2026-03-30")).queryByTestId("social-note-dst")).toBeNull();
    });

    it("une erreur de lecture des notes laisse le calendrier utilisable, avec un bandeau et Réessayer", () => {
      h.notesError = true;
      renderPage();
      expect(screen.getByText("Post du soir")).toBeInTheDocument();
      expect(screen.getByText("Non planifiés · 1")).toBeInTheDocument();
      expect(screen.getByText("Notes indisponibles")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
      expect(h.notesRefetch).toHaveBeenCalledTimes(1);
      expect(h.refetch).not.toHaveBeenCalled();
    });

    it("affiche l'erreur d'un déplacement de note en toast", () => {
      const n1 = note("n1", "2026-11-12", "Lancement");
      h.notes = [n1];
      h.noteMutate.mockImplementation((_v: unknown, cb: { onError?: (e: unknown) => void }) => cb.onError?.(new Error("Note introuvable")));
      renderPage();
      h.onDragEnd?.({ active: { id: "note:n1", data: { current: { note: n1 } } }, over: { id: "day:2026-11-14" } });
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "Note introuvable", variant: "destructive" }));
    });

    it("signale une note déplacée hors de la grille par le champ Jour, pas une note restée visible", () => {
      h.notes = [note("n1", "2026-11-12", "Lancement")];
      h.noteMutate.mockImplementation((_v: unknown, cb: { onSuccess?: () => void }) => cb.onSuccess?.());
      renderPage();
      fireEvent.click(screen.getByTestId("social-note-n1"));
      fireEvent.change(screen.getByLabelText("Jour"), { target: { value: "2026-11-20" } });
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
      expect(h.toast).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("social-note-n1"));
      fireEvent.change(screen.getByLabelText("Jour"), { target: { value: "2026-12-15" } });
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
      expect(h.noteMutate).toHaveBeenLastCalledWith(expect.objectContaining({ id: "n1", day: "2026-12-15" }), expect.anything());
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Note déplacée au 15/12" }));
    });

    it("déplace une note glissée sur un autre jour, sans toucher aux contenus, et ignore un dépôt sur son jour", () => {
      const n1 = note("n1", "2026-11-12", "Lancement");
      h.notes = [n1];
      renderPage();
      h.onDragEnd?.({ active: { id: "note:n1", data: { current: { note: n1 } } }, over: { id: "day:2026-11-14" } });
      expect(h.noteMutate).toHaveBeenCalledWith({ id: "n1", day: "2026-11-14" }, expect.anything());
      expect(h.mutate).not.toHaveBeenCalled();
      h.noteMutate.mockClear();
      h.onDragEnd?.({ active: { id: "note:n1", data: { current: { note: n1 } } }, over: { id: "day:2026-11-12" } });
      h.onDragEnd?.({ active: { id: "note:n1", data: { current: { note: n1 } } }, over: null });
      expect(h.noteMutate).not.toHaveBeenCalled();
    });
  });
});
