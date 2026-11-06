import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import SocialContentsPage from "@/pages/SocialContentsPage";
import type { SocialChannel, SocialContentGroup, SocialPost } from "@/services/socialContents";

const h = vi.hoisted(() => ({
  mutate: vi.fn(),
  rangeArgs: vi.fn(),
  refetch: vi.fn(),
  undatedError: false,
  instagramLimit: null as number | null,
  onDragEnd: null as null | ((e: unknown) => void),
  dated: [] as unknown[],
  themes: [] as unknown[],
  undated: [] as unknown[],
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
}));
vi.mock("@/components/social/SocialSettingsDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="settings">Réglages ouverts</div> : null),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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
    const themesBar = screen.getByRole("group", { name: "Thème" });
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
    fireEvent.click(within(screen.getByRole("group", { name: "Thème" })).getByRole("button", { name: "IA appliquée" }));
    expect(screen.queryByText("Reel Instagram")).toBeNull();
    expect(screen.getByText("Non planifiés · 0")).toBeInTheDocument();
    h.themes = [];
    rerender(<MemoryRouter><TooltipProvider><SocialContentsPage /></TooltipProvider></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "Thème" })).toBeNull();
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
    expect(screen.queryByRole("group", { name: "Thème" })).toBeNull();
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
});
