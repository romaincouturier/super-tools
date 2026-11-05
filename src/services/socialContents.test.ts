import { describe, expect, it } from "vitest";
import { buildGroupPosts, parisLocalToUtcIso, utcIsoToParisLocal } from "./socialContents";

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
