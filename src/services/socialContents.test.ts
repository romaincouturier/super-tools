import { describe, expect, it } from "vitest";
import {
  cardLabel,
  defaultTitle,
  detailsFromGroup,
  detailsPayload,
  groupThemeIds,
  hasMissingVisual,
  moveItem,
  preparationState,
  validateDateRemoval,
  validateStatusChange,
  buildGroupPosts,
  buildMonthGrid,
  buildWeekGrid,
  applySocialFilters,
  emptySocialFilters,
  filterCards,
  groupDisplayStatus,
  moveKeepingTime,
  notesByDay,
  parisDayKey,
  parisLocalToUtcIso,
  placeGroups,
  publishedPostEdits,
  utcIsoToParisLocal,
  visibleChannelIdsFor,
  withGroupDate,
  type SocialCalendarNote,
  type SocialContentGroup,
  type SocialFilters,
  type SocialPost,
  type SocialPublicationStatus,
} from "./socialContents";

describe("buildGroupPosts", () => {
  const base = {
    channelIds: ["li", "in", "fa"], commonText: "Commun", texts: {}, commonMediaId: null, mediaIds: {}, scheduledAt: null,
  };

  it("crée un post par canal coché avec le texte commun quand la synchro est active", () => {
    expect(buildGroupPosts({ ...base, sync: true, texts: { li: "ignoré" } })).toEqual([
      { channel_id: "li", text: "Commun", scheduled_at: null, media_id: null },
      { channel_id: "in", text: "Commun", scheduled_at: null, media_id: null },
      { channel_id: "fa", text: "Commun", scheduled_at: null, media_id: null },
    ]);
  });

  it("prend le texte propre à chaque canal quand la synchro est coupée, le texte commun à défaut", () => {
    const posts = buildGroupPosts({ ...base, sync: false, texts: { li: "LinkedIn", in: "Insta" } });
    expect(posts.map((p) => p.text)).toEqual(["LinkedIn", "Insta", "Commun"]);
  });

  it("ne crée aucun post sans canal et dédoublonne les canaux", () => {
    expect(buildGroupPosts({ ...base, sync: true, channelIds: [] })).toEqual([]);
    expect(buildGroupPosts({ ...base, sync: true, channelIds: ["li", "li"] })).toHaveLength(1);
  });

  it("porte le visuel commun quand la synchro est active, le visuel propre sinon", () => {
    expect(buildGroupPosts({ ...base, sync: true, commonMediaId: "m0", mediaIds: { li: "m1" } }).map((p) => p.media_id))
      .toEqual(["m0", "m0", "m0"]);
    expect(buildGroupPosts({ ...base, sync: false, commonMediaId: "m0", mediaIds: { li: "m1", in: null } }).map((p) => p.media_id))
      .toEqual(["m1", null, "m0"]);
  });

  it("porte la même date sur toutes les déclinaisons", () => {
    const posts = buildGroupPosts({ ...base, sync: true, scheduledAt: "2026-11-20T08:30:00.000Z" });
    expect(posts.every((p) => p.scheduled_at === "2026-11-20T08:30:00.000Z")).toBe(true);
  });
});

describe("heure de Paris", () => {
  it("convertit l'heure d'hiver et l'heure d'été", () => {
    expect(parisLocalToUtcIso("2026-01-15", "09:00")).toBe("2026-01-15T08:00:00.000Z");
    expect(parisLocalToUtcIso("2026-07-15", "09:00")).toBe("2026-07-15T07:00:00.000Z");
  });

  it("encadre les changements d'heure", () => {
    expect(parisLocalToUtcIso("2026-03-29", "03:30")).toBe("2026-03-29T01:30:00.000Z");
    expect(parisLocalToUtcIso("2026-10-25", "12:00")).toBe("2026-10-25T11:00:00.000Z");
  });

  it("fige le traitement d'une heure inexistante et d'une heure ambiguë", () => {
    // 02:30 n'existe pas le 29 mars : l'instant rendu est 03:30 heure d'été.
    expect(parisLocalToUtcIso("2026-03-29", "02:30")).toBe("2026-03-29T01:30:00.000Z");
    // 02:30 existe deux fois le 25 octobre : la seconde occurrence (heure d'hiver) est retenue.
    expect(parisLocalToUtcIso("2026-10-25", "02:30")).toBe("2026-10-25T01:30:00.000Z");
  });

  it("relit un instant en jour et heure de Paris", () => {
    expect(utcIsoToParisLocal("2026-01-15T08:00:00.000Z")).toEqual({ date: "2026-01-15", time: "09:00" });
    expect(utcIsoToParisLocal("2026-07-15T22:30:00.000Z")).toEqual({ date: "2026-07-16", time: "00:30" });
  });
});

const post = (channel_id: string, publication_status: SocialPublicationStatus, scheduled_at: string | null, group_id = "g"): SocialPost => ({
  id: `${group_id}-${channel_id}`, group_id, channel_id, text: "t", scheduled_at, publication_status, media_id: "m",
});
const group = (id: string, posts: SocialPost[]): SocialContentGroup => ({
  id, format: "post", sync: true, theme_id: null, created_by: null, created_at: "", updated_at: "", posts,
});

describe("groupDisplayStatus", () => {
  it("retient le statut le moins avancé des déclinaisons", () => {
    expect(groupDisplayStatus([post("a", "published", "x"), post("b", "scheduled", "x")])).toBe("scheduled");
    expect(groupDisplayStatus([post("a", "scheduled", "x"), post("b", "unscheduled", null)])).toBe("unscheduled");
    expect(groupDisplayStatus([post("a", "published", "x")])).toBe("published");
    expect(groupDisplayStatus([])).toBe("unscheduled");
  });
});

describe("groupDisplayStatus : contenu partiellement publié (story 1.5)", () => {
  it("affiche Programmé quand une seule déclinaison est publiée, Publié quand toutes le sont", () => {
    expect(groupDisplayStatus([post("li", "published", "x"), post("in", "scheduled", "x")])).toBe("scheduled");
    expect(groupDisplayStatus([post("li", "published", "x"), post("in", "published", "x")])).toBe("published");
  });
});

describe("publishedPostEdits", () => {
  const posts = [
    { id: "p-li", channel_id: "li", text: "Publié", media_id: "m1", publication_status: "published" as const },
    { id: "p-in", channel_id: "in", text: "Commun", media_id: "m1", publication_status: "scheduled" as const },
  ];

  it("ne retient que les déclinaisons publiées modifiées", () => {
    expect(publishedPostEdits(posts, { channelIds: ["li", "in"], texts: { li: "Publié", in: "Autre" }, mediaIds: { li: "m1", in: null } })).toEqual([]);
    expect(publishedPostEdits(posts, { channelIds: ["li", "in"], texts: { li: "Corrigé", in: "Commun" }, mediaIds: {} })).toEqual([
      { postId: "p-li", text: "Corrigé", mediaId: "m1" },
    ]);
    expect(publishedPostEdits(posts, { channelIds: ["li"], texts: {}, mediaIds: { li: null } })).toEqual([
      { postId: "p-li", text: "Publié", mediaId: null },
    ]);
  });

  it("ignore une déclinaison publiée retirée de la saisie", () => {
    expect(publishedPostEdits(posts, { channelIds: ["in"], texts: { li: "Corrigé" }, mediaIds: {} })).toEqual([]);
  });
});

describe("parisDayKey", () => {
  it("range un post du soir sur son jour de Paris, pas sur celui en UTC", () => {
    // 23:30 à Paris le 12 novembre = 22:30 UTC le 12 ; 00:30 à Paris le 13 = 23:30 UTC le 12.
    expect(parisDayKey("2026-11-12T22:30:00.000Z")).toBe("2026-11-12");
    expect(parisDayKey("2026-11-12T23:30:00.000Z")).toBe("2026-11-13");
    // En été, 23:30 à Paris = 21:30 UTC ; 00:30 à Paris = 22:30 UTC la veille.
    expect(parisDayKey("2026-07-15T22:30:00.000Z")).toBe("2026-07-16");
  });

  it("reste juste autour des changements d'heure", () => {
    expect(parisDayKey("2026-03-28T23:30:00.000Z")).toBe("2026-03-29");
    expect(parisDayKey("2026-03-29T21:59:00.000Z")).toBe("2026-03-29");
    expect(parisDayKey("2026-10-25T22:59:00.000Z")).toBe("2026-10-25");
    expect(parisDayKey("2026-10-25T23:00:00.000Z")).toBe("2026-10-26");
  });
});

describe("moveKeepingTime", () => {
  it("donne 09:00 à Paris à un brouillon sans date", () => {
    expect(moveKeepingTime(null, "2026-11-12")).toBe("2026-11-12T08:00:00.000Z");
  });

  it("change le jour et garde l'heure de Paris", () => {
    // 18:00 le 3 novembre -> 18:00 le 10 novembre.
    expect(moveKeepingTime("2026-11-03T17:00:00.000Z", "2026-11-10")).toBe("2026-11-10T17:00:00.000Z");
  });

  it("garde l'heure de Paris à travers un changement d'heure", () => {
    // 18:00 heure d'été le 20 octobre -> 18:00 heure d'hiver le 27 octobre.
    expect(moveKeepingTime("2026-10-20T16:00:00.000Z", "2026-10-27")).toBe("2026-10-27T17:00:00.000Z");
    // 23:30 le 3 novembre (22:30 UTC) -> 23:30 le 10.
    expect(moveKeepingTime("2026-11-03T22:30:00.000Z", "2026-11-10")).toBe("2026-11-10T22:30:00.000Z");
  });
});

describe("grilles du calendrier", () => {
  it("construit le mois en semaines du lundi au dimanche, jours hors mois marqués", () => {
    const weeks = buildMonthGrid("2026-11-18");
    // Le 1er novembre 2026 est un dimanche : la grille part du lundi 26 octobre.
    expect(weeks[0][0]).toEqual({ key: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ key: "2026-11-01", inMonth: true });
    expect(weeks.at(-1)?.[6]).toEqual({ key: "2026-12-06", inMonth: false });
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("couvre un mois qui commence un lundi sans semaine de trop", () => {
    const weeks = buildMonthGrid("2027-02-10");
    expect(weeks[0][0].key).toBe("2027-02-01");
    expect(weeks).toHaveLength(4);
    expect(weeks.at(-1)?.[6].key).toBe("2027-02-28");
  });

  it("construit la semaine du lundi au dimanche, à cheval sur deux mois", () => {
    expect(buildWeekGrid("2026-11-01").map((d) => d.key)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(buildWeekGrid("2026-11-02")[0].key).toBe("2026-11-02");
  });
});

describe("placeGroups", () => {
  const all = new Set(["li", "in"]);

  it("calcule les alertes des seules déclinaisons visibles, avec la limite du canal", () => {
    const limits = new Map([["li", { text_limit: 3 }], ["in", { text_limit: null }]]);
    const g = group("g", [
      { ...post("li", "unscheduled", null), text: "trop long" },
      { ...post("in", "unscheduled", null), media_id: null },
    ]);
    const [card] = placeGroups([g], all, undefined, limits).undated;
    expect(card.alerts).toEqual([
      { channelId: "li", alerts: [{ kind: "text_too_long", length: 9, limit: 3, excess: 6 }] },
      { channelId: "in", alerts: [{ kind: "missing_visual" }] },
    ]);
    expect(placeGroups([g], new Set(["li"]), undefined, limits).undated[0].alerts.map((a) => a.channelId)).toEqual(["li"]);
    expect(placeGroups([group("ok", [post("li", "unscheduled", null, "ok")])], all, undefined, limits).undated[0].alerts).toEqual([]);
    const published = group("pub", [{ ...post("li", "published", "2026-11-03T17:00:00.000Z", "pub"), media_id: null, text: "trop long" }]);
    expect(placeGroups([published], all, undefined, limits).byDay.get("2026-11-03")?.[0].alerts).toEqual([]);
  });

  it("range les brouillons dans la colonne et les datés sur leur jour de Paris, triés par heure", () => {
    const { undated, byDay } = placeGroups([
      group("draft", [post("li", "unscheduled", null, "draft"), post("in", "unscheduled", null, "draft")]),
      group("late", [post("li", "scheduled", "2026-11-12T22:30:00.000Z", "late")]),
      group("early", [post("li", "scheduled", "2026-11-12T08:00:00.000Z", "early")]),
    ], all);
    expect(undated.map((c) => c.group.id)).toEqual(["draft"]);
    expect(byDay.get("2026-11-12")?.map((c) => c.group.id)).toEqual(["early", "late"]);
  });

  it("garde la carte au statut le moins avancé d'un contenu partiellement publié, à la date de la non publiée", () => {
    const { byDay } = placeGroups([
      group("g", [post("li", "published", "2026-11-03T17:00:00.000Z"), post("in", "scheduled", "2026-11-10T17:00:00.000Z")]),
    ], all);
    expect(byDay.get("2026-11-10")?.[0]).toMatchObject({ status: "scheduled", scheduledAt: "2026-11-10T17:00:00.000Z" });
    expect(byDay.has("2026-11-03")).toBe(false);
  });

  it("place un contenu entièrement publié à la date de ses publiées", () => {
    const { byDay } = placeGroups([
      group("g", [post("li", "published", "2026-11-03T17:00:00.000Z"), post("in", "published", "2026-11-05T17:00:00.000Z")]),
    ], all);
    expect(byDay.get("2026-11-03")?.[0]).toMatchObject({ status: "published", scheduledAt: "2026-11-03T17:00:00.000Z" });
  });

  it("place sur son jour un contenu publié en partie dont une déclinaison n'a pas de date", () => {
    const { undated, byDay } = placeGroups([
      group("g", [post("li", "published", "2026-11-03T17:00:00.000Z"), post("in", "unscheduled", null)]),
    ], all);
    expect(undated).toHaveLength(0);
    expect(byDay.get("2026-11-03")?.[0]).toMatchObject({ status: "unscheduled", scheduledAt: "2026-11-03T17:00:00.000Z" });
  });

  it("retient la déclinaison datée dans la plage chargée", () => {
    const { byDay } = placeGroups([
      group("g", [post("li", "published", "2026-10-01T08:00:00.000Z"), post("in", "scheduled", "2026-11-10T17:00:00+00:00")]),
    ], all, { fromIso: "2026-10-25T23:00:00.000Z", toIso: "2026-12-06T23:00:00.000Z" });
    expect([...byDay.keys()]).toEqual(["2026-11-10"]);
  });

  it("garde dans la grille un contenu dont seule la publiée est dans la plage", () => {
    const { byDay } = placeGroups([
      group("g", [post("li", "published", "2026-11-10T08:00:00.000Z"), post("in", "scheduled", "2026-12-15T08:00:00.000Z")]),
    ], all, { fromIso: "2026-10-25T23:00:00.000Z", toIso: "2026-12-06T23:00:00.000Z" });
    expect([...byDay.keys()]).toEqual(["2026-11-10"]);
  });

  it("trie les cartes d'un jour par instant, quel que soit le format ISO", () => {
    const { byDay } = placeGroups([
      group("a", [post("li", "scheduled", "2026-11-12T09:00:00.000Z", "a")]),
      // 09:30+01:00 = 08:30 UTC : avant « a », alors que l'ordre des chaînes dit l'inverse.
      group("b", [post("li", "scheduled", "2026-11-12T09:30:00+01:00", "b")]),
    ], all);
    expect(byDay.get("2026-11-12")?.map((c) => c.group.id)).toEqual(["b", "a"]);
  });

  it("retire les déclinaisons d'un canal masqué et fait disparaître un contenu sans déclinaison visible", () => {
    const { undated } = placeGroups([
      group("insta", [post("in", "unscheduled", null, "insta")]),
      group("both", [post("li", "unscheduled", null, "both"), post("in", "unscheduled", null, "both")]),
    ], new Set(["li"]));
    expect(undated.map((c) => c.group.id)).toEqual(["both"]);
    expect(undated[0].posts.map((p) => p.channel_id)).toEqual(["li"]);
  });

  it("compte une fois un groupe présent dans deux listes", () => {
    const g = group("g", [post("li", "unscheduled", null)]);
    expect(placeGroups([g, g], all).undated).toHaveLength(1);
  });
});

describe("withGroupDate", () => {
  it("date les déclinaisons non publiées et laisse la publiée intacte", () => {
    const g = withGroupDate(group("g", [post("li", "published", "2026-11-03T17:00:00.000Z"), post("in", "unscheduled", null)]), "2026-11-12T08:00:00.000Z");
    expect(g.posts.map((p) => [p.publication_status, p.scheduled_at])).toEqual([
      ["published", "2026-11-03T17:00:00.000Z"],
      ["unscheduled", "2026-11-12T08:00:00.000Z"],
    ]);
  });

  it("garde Programmé quand la date d'un contenu programmé change", () => {
    const g = withGroupDate(group("g", [post("li", "scheduled", "2026-11-03T17:00:00.000Z")]), "2026-11-12T08:00:00.000Z");
    expect(g.posts[0].publication_status).toBe("scheduled");
  });
});

describe("statut indépendant de la date", () => {
  it("brouillon daté : placé sur son jour, en Brouillon, absent de Non planifiés", () => {
    const { undated, byDay } = placeGroups([group("d", [post("li", "unscheduled", "2026-11-12T08:00:00.000Z", "d")])], new Set(["li"]));
    expect(undated).toEqual([]);
    expect(byDay.get("2026-11-12")?.[0].status).toBe("unscheduled");
  });

  it("refuse Programmé sans date, accepte Programmé daté et Brouillon sans date", () => {
    expect(validateStatusChange("scheduled", null)).toBe("Indiquez une date et une heure pour programmer");
    expect(validateStatusChange("scheduled", "2026-11-12T08:00:00.000Z")).toBeNull();
    expect(validateStatusChange("unscheduled", null)).toBeNull();
  });

  it("refuse d'effacer la date tant qu'une déclinaison est Programmé", () => {
    expect(validateDateRemoval(["unscheduled", "scheduled"])).toBe("Repassez en Brouillon avant de retirer la date");
    expect(validateDateRemoval(["unscheduled"])).toBeNull();
  });

  it("transmet le statut choisi à l'enregistrement, Brouillon par défaut pour une nouvelle déclinaison", () => {
    const posts = buildGroupPosts({
      sync: true, channelIds: ["li", "in"], commonText: "x", texts: {}, commonMediaId: null, mediaIds: {},
      scheduledAt: "2026-11-12T08:00:00.000Z", statuses: { li: "scheduled", in: "unscheduled" },
    });
    expect(posts.map((p) => p.publication_status)).toEqual(["scheduled", "unscheduled"]);
  });
});

describe("filtres", () => {
  const channels = [{ id: "li" }, { id: "in" }];
  const themed = (id: string, theme_id: string | null, posts: SocialPost[]) => ({ ...group(id, posts), theme_id });
  const groups = [
    themed("a-prog", "A", [post("li", "scheduled", "2026-11-12T08:00:00.000Z", "a-prog")]),
    themed("a-brou", "A", [post("li", "unscheduled", null, "a-brou")]),
    themed("b-prog", "B", [post("in", "scheduled", "2026-11-13T08:00:00.000Z", "b-prog")]),
    themed("c-prog", "C", [post("li", "scheduled", "2026-11-14T08:00:00.000Z", "c-prog")]),
    themed("sans", null, [post("li", "scheduled", "2026-11-15T08:00:00.000Z", "sans")]),
    // LinkedIn publié, Instagram programmé : statut affiché Programmé, Publié si on ne garde que LinkedIn.
    themed("mixte", "B", [
      post("li", "published", "2026-11-16T08:00:00.000Z", "mixte"),
      post("in", "scheduled", "2026-11-16T09:00:00.000Z", "mixte"),
    ]),
  ];
  const filters = (patch: Partial<SocialFilters>): SocialFilters => ({ ...emptySocialFilters(), ...patch });
  /** Ce que la page affiche : placement sur les réseaux visibles, puis thème et statut. */
  const shown = (f: SocialFilters) => {
    const { undated, byDay } = placeGroups(groups, visibleChannelIdsFor(f, channels));
    return filterCards([...undated, ...[...byDay.values()].flat()], f).map((c) => c.group.id).sort();
  };

  it("1.4-UNIT-001 : aucune pastille, tous les contenus", () => {
    expect(shown(emptySocialFilters())).toEqual(["a-brou", "a-prog", "b-prog", "c-prog", "mixte", "sans"]);
  });

  it("1.4-UNIT-001 : OU dans une famille, contenus du thème A ou du thème B", () => {
    expect(shown(filters({ themeIds: new Set(["A", "B"]) }))).toEqual(["a-brou", "a-prog", "b-prog", "mixte"]);
  });

  it("1.4-UNIT-001 : un contenu sans thème est masqué dès qu'une pastille de thème est active", () => {
    expect(shown(filters({ themeIds: new Set(["C"]) }))).toEqual(["c-prog"]);
  });

  it("1.4-UNIT-002 : ET entre familles, thème A et Programmé", () => {
    expect(shown(filters({ themeIds: new Set(["A"]), statuses: new Set(["scheduled"]) }))).toEqual(["a-prog"]);
  });

  it("1.4-UNIT-002 : réseau LinkedIn, cartes réduites aux déclinaisons LinkedIn, contenus sans LinkedIn masqués", () => {
    const f = filters({ channelIds: new Set(["li"]) });
    expect(shown(f)).toEqual(["a-brou", "a-prog", "c-prog", "mixte", "sans"]);
    const mixte = [...placeGroups(groups, visibleChannelIdsFor(f, channels)).byDay.values()].flat().find((c) => c.group.id === "mixte");
    expect(mixte?.posts.map((p) => p.channel_id)).toEqual(["li"]);
    expect(mixte?.status).toBe("published");
  });

  it("1.4-UNIT-002 : statut mixte, Publié + LinkedIn affiche la carte, Publié seul la masque", () => {
    expect(shown(filters({ channelIds: new Set(["li"]), statuses: new Set(["published"]) }))).toEqual(["mixte"]);
    expect(shown(filters({ statuses: new Set(["published"]) }))).toEqual([]);
    expect(shown(filters({ statuses: new Set(["published", "scheduled"]) }))).toEqual(["a-prog", "b-prog", "c-prog", "mixte", "sans"]);
  });

  it("famille Réseau vide : tous les canaux sont visibles", () => {
    expect(visibleChannelIdsFor(emptySocialFilters(), channels)).toEqual(new Set(["li", "in"]));
    expect(visibleChannelIdsFor(filters({ channelIds: new Set(["in"]) }), channels)).toEqual(new Set(["in"]));
  });
});

describe("applySocialFilters", () => {
  const channels = [{ id: "li", text_limit: null }, { id: "in", text_limit: null }];
  const themed = (id: string, theme_id: string | null, posts: SocialPost[]) => ({ ...group(id, posts), theme_id });
  const groups = [
    themed("a", "A", [post("li", "scheduled", "2026-11-12T08:00:00.000Z", "a")]),
    themed("b", "B", [post("in", "scheduled", "2026-11-13T08:00:00.000Z", "b")]),
    themed("brouillon", "A", [post("li", "unscheduled", null, "brouillon")]),
    themed("publie", "A", [post("li", "published", "2026-11-14T08:00:00.000Z", "publie")]),
  ];
  const ids = (r: ReturnType<typeof applySocialFilters>) =>
    [...r.undated, ...[...r.byDay.values()].flat()].map((c) => c.group.id).sort();
  const themes = new Set(["A", "B"]);

  it("filtre grille et non planifiés, et retire les jours vidés", () => {
    const r = applySocialFilters(groups, { ...emptySocialFilters(), statuses: new Set(["scheduled"]) }, channels, themes);
    expect(r.undated).toEqual([]);
    expect([...r.byDay.keys()].sort()).toEqual(["2026-11-12", "2026-11-13"]);
    expect(ids(r)).toEqual(["a", "b"]);
  });

  it("un thème supprimé encore sélectionné ne filtre plus", () => {
    const f = { ...emptySocialFilters(), themeIds: new Set(["disparu"]) };
    expect(ids(applySocialFilters(groups, f, channels, themes))).toEqual(["a", "b", "brouillon", "publie"]);
    const mixed = { ...emptySocialFilters(), themeIds: new Set(["disparu", "B"]) };
    expect(ids(applySocialFilters(groups, mixed, channels, themes))).toEqual(["b"]);
  });

  it("un canal disparu encore sélectionné ne filtre plus", () => {
    const f = { ...emptySocialFilters(), channelIds: new Set(["fa"]) };
    expect(ids(applySocialFilters(groups, f, channels, themes))).toEqual(["a", "b", "brouillon", "publie"]);
    const mixed = { ...emptySocialFilters(), channelIds: new Set(["fa", "in"]) };
    expect(ids(applySocialFilters(groups, mixed, channels, themes))).toEqual(["b"]);
  });
});

describe("notes du calendrier (story 1.6)", () => {
  const note = (id: string, day: string, created_at: string): SocialCalendarNote => ({
    id, day, text: `Note ${id}`, color: "#f97316", created_at,
  });

  it("regroupe les notes par jour, dans l'ordre de création", () => {
    const byDay = notesByDay([
      note("b", "2026-11-12", "2026-11-02T10:00:00Z"),
      note("c", "2026-11-14", "2026-11-01T10:00:00Z"),
      note("a", "2026-11-12", "2026-11-01T09:00:00Z"),
    ]);
    expect([...byDay.keys()].sort()).toEqual(["2026-11-12", "2026-11-14"]);
    expect(byDay.get("2026-11-12")?.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("1.6-SQL-001 côté front : un jour de changement d'heure reste sa propre clé, en TZ=UTC", () => {
    const byDay = notesByDay([note("dst", "2026-03-29", "2026-03-01T00:00:00Z"), note("lendemain", "2026-03-30", "2026-03-01T00:00:00Z")]);
    expect(byDay.get("2026-03-29")?.map((n) => n.id)).toEqual(["dst"]);
    expect(byDay.get("2026-03-30")?.map((n) => n.id)).toEqual(["lendemain"]);
  });
});

describe("enrichissement d'un contenu (lot 1)", () => {
  const allChecks = { check_text_ready: true, check_visual_ready: true, check_links_checked: true, check_proofread: true };

  it("titre vide : la carte affiche le début du texte, sinon le titre interne", () => {
    expect(cardLabel({ title: null }, "  Bonjour à tous ")).toBe("Bonjour à tous");
    expect(cardLabel({ title: "  " }, "Texte")).toBe("Texte");
    expect(cardLabel({ title: "Atelier IA" }, "Texte")).toBe("Atelier IA");
  });

  it("titre par défaut : début du texte sur une ligne, coupé au mot avant 80 caractères", () => {
    expect(defaultTitle("Un\nsimple   texte")).toBe("Un simple texte");
    const long = "mot ".repeat(40);
    const t = defaultTitle(long);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(81);
  });

  it("indicateur : à compléter, puis à valider, puis validé", () => {
    expect(preparationState({ ...allChecks, check_proofread: false })).toBe("to_complete");
    expect(preparationState({})).toBe("to_complete");
    expect(preparationState({ ...allChecks, validated_at: null })).toBe("to_validate");
    expect(preparationState({ ...allChecks, validated_at: "2026-11-10T10:00:00Z" })).toBe("validated");
  });

  it("sans visuel : une déclinaison non publiée sans visuel, jamais une publiée", () => {
    expect(hasMissingVisual([{ media_id: null, publication_status: "unscheduled" }])).toBe(true);
    expect(hasMissingVisual([{ media_id: null, publication_status: "published" }, { media_id: "m", publication_status: "scheduled" }])).toBe(false);
  });

  it("expertises : la liaison multi-valeurs, l'ancien thème unique à défaut", () => {
    expect(groupThemeIds({ theme_links: [{ theme_id: "a" }, { theme_id: "b" }], theme_id: "old" })).toEqual(["a", "b"]);
    expect(groupThemeIds({ theme_links: [], theme_id: "old" })).toEqual(["old"]);
    expect(groupThemeIds({ theme_id: null })).toEqual([]);
  });

  it("filtres expertise, catégorie, sans visuel, à compléter et à valider", () => {
    const g = (id: string, extra: Partial<SocialContentGroup>, media: string | null = "m") =>
      ({ ...group(id, [{ ...post("li", "unscheduled", null, id), media_id: media }]), ...extra });
    const groups = [
      g("ia", { theme_links: [{ theme_id: "IA" }, { theme_id: "FG" }], editorial_category: "tutorial", ...allChecks }),
      g("fg", { theme_links: [{ theme_id: "FG" }], editorial_category: "humor" }, null),
      g("ok", { ...allChecks, validated_at: "2026-11-10T10:00:00Z" }),
    ];
    const ids = (f: Partial<SocialFilters>) => applySocialFilters(groups, { ...emptySocialFilters(), ...f }, [{ id: "li", text_limit: null }], new Set(["IA", "FG"]))
      .undated.map((c) => c.group.id);
    expect(ids({ themeIds: new Set(["FG"]) })).toEqual(["ia", "fg"]);
    expect(ids({ categories: new Set(["humor"]) })).toEqual(["fg"]);
    expect(ids({ practical: new Set(["no_visual"]) })).toEqual(["fg"]);
    expect(ids({ practical: new Set(["to_complete"]) })).toEqual(["fg"]);
    expect(ids({ practical: new Set(["to_validate"]) })).toEqual(["ia"]);
  });

  it("enregistrement : titre par défaut, lignes de source vides ignorées, diapositives ordonnées", () => {
    const form = { ...detailsFromGroup(null), visual_slides: ["Un", "Deux"],
      sources: [{ url: " https://exemple.fr ", label: "", content_card_id: null, content_card_title: null },
        { url: "", label: "vide", content_card_id: null, content_card_title: null },
        { url: "", label: "", content_card_id: "nl", content_card_title: "NL" }] };
    expect(detailsPayload(form, "Texte du post")).toMatchObject({
      title: "Texte du post",
      visual_slides: [{ content: "Un" }, { content: "Deux" }],
      sources: [{ url: "https://exemple.fr", label: null, content_card_id: null }, { url: null, label: null, content_card_id: "nl" }],
    });
  });

  it("déplace une diapositive, sans effet hors bornes", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });
});
