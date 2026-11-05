import { describe, expect, it } from "vitest";
import {
  buildGroupPosts,
  buildMonthGrid,
  buildWeekGrid,
  groupDisplayStatus,
  moveKeepingTime,
  parisDayKey,
  parisLocalToUtcIso,
  placeGroups,
  utcIsoToParisLocal,
  withGroupDate,
  type SocialContentGroup,
  type SocialPost,
  type SocialPublicationStatus,
} from "./socialContents";

describe("buildGroupPosts", () => {
  const base = { channelIds: ["li", "in", "fa"], commonText: "Commun", texts: {}, scheduledAt: null };

  it("crée un post par canal coché avec le texte commun quand la synchro est active", () => {
    expect(buildGroupPosts({ ...base, sync: true, texts: { li: "ignoré" } })).toEqual([
      { channel_id: "li", text: "Commun", scheduled_at: null },
      { channel_id: "in", text: "Commun", scheduled_at: null },
      { channel_id: "fa", text: "Commun", scheduled_at: null },
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
  id: `${group_id}-${channel_id}`, group_id, channel_id, text: "t", scheduled_at, publication_status,
});
const group = (id: string, posts: SocialPost[]): SocialContentGroup => ({
  id, format: "post", sync: true, created_by: null, created_at: "", updated_at: "", posts,
});

describe("groupDisplayStatus", () => {
  it("retient le statut le moins avancé des déclinaisons", () => {
    expect(groupDisplayStatus([post("a", "published", "x"), post("b", "scheduled", "x")])).toBe("scheduled");
    expect(groupDisplayStatus([post("a", "scheduled", "x"), post("b", "unscheduled", null)])).toBe("unscheduled");
    expect(groupDisplayStatus([post("a", "published", "x")])).toBe("published");
    expect(groupDisplayStatus([])).toBe("unscheduled");
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

  it("range les brouillons dans la colonne et les datés sur leur jour de Paris, triés par heure", () => {
    const { undated, byDay } = placeGroups([
      group("draft", [post("li", "unscheduled", null, "draft"), post("in", "unscheduled", null, "draft")]),
      group("late", [post("li", "scheduled", "2026-11-12T22:30:00.000Z", "late")]),
      group("early", [post("li", "scheduled", "2026-11-12T08:00:00.000Z", "early")]),
    ], all);
    expect(undated.map((c) => c.group.id)).toEqual(["draft"]);
    expect(byDay.get("2026-11-12")?.map((c) => c.group.id)).toEqual(["early", "late"]);
  });

  it("garde la carte au statut le moins avancé d'un contenu partiellement publié", () => {
    const { byDay } = placeGroups([
      group("g", [post("li", "published", "2026-11-03T17:00:00.000Z"), post("in", "scheduled", "2026-11-10T17:00:00.000Z")]),
    ], all);
    expect(byDay.get("2026-11-03")?.[0]).toMatchObject({ status: "scheduled", scheduledAt: "2026-11-03T17:00:00.000Z" });
    expect(byDay.has("2026-11-10")).toBe(false);
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
      ["scheduled", "2026-11-12T08:00:00.000Z"],
    ]);
  });
});
