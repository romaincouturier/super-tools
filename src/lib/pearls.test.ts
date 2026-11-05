import { describe, expect, it } from "vitest";
import { filterPearls, formatPearlDate } from "./pearls";
import { pearlAuthorLabel, type Pearl } from "@/services/pearls";

describe("formatPearlDate", () => {
  it("affiche la date en français sans heure", () => {
    expect(formatPearlDate("2026-11-04")).toBe("4 novembre 2026");
  });

  it("ajoute l'heure tronquée à HH:MM quand elle est connue", () => {
    expect(formatPearlDate("2026-11-04", "08:34:23")).toBe("4 novembre 2026 à 08:34");
  });

  it("ignore une heure nulle", () => {
    expect(formatPearlDate("2026-02-03", null)).toBe("3 février 2026");
  });
});

describe("pearlAuthorLabel", () => {
  it("ne révèle jamais l'auteur d'une perle anonyme", () => {
    expect(pearlAuthorLabel({ is_anonymous: true, author_name: "Tobias", author_company: "Arturia" })).toBe("Anonyme");
  });

  it("assemble nom et entreprise", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: "Tobias", author_company: "Arturia" })).toBe("Tobias, Arturia");
  });

  it("n'affiche que le champ renseigné", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: "Odile", author_company: null })).toBe("Odile");
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: null, author_company: "EDHEC" })).toBe("EDHEC");
  });

  it("retombe sur Anonyme sans nom ni entreprise", () => {
    expect(pearlAuthorLabel({ is_anonymous: false, author_name: null, author_company: null })).toBe("Anonyme");
  });
});

const base: Pearl = {
  id: "1", title: null, message: "Merci pour la formation", message_fr: null, author_name: "Odile", author_company: null,
  is_anonymous: false, is_positive: true, pearl_date: "2026-11-02", pearl_time: null, source: "mail", image_path: null,
  gmail_thread_id: null, legacy_notion_id: null, archived: false, created_at: "", updated_at: "",
};
const all = { search: "", source: "all", tone: "all", showArchived: false };

describe("filterPearls", () => {
  const positive = { ...base, id: "p" };
  const other = { ...base, id: "o", is_positive: false, message: "Question sur le CPF", source: "notion" as const };
  const archived = { ...base, id: "a", archived: true };
  const list = [positive, other, archived];

  it("masque les archivées par défaut et les montre sur demande", () => {
    expect(filterPearls(list, all).map((p) => p.id)).toEqual(["p", "o"]);
    expect(filterPearls(list, { ...all, showArchived: true }).map((p) => p.id)).toEqual(["p", "o", "a"]);
  });

  it("sépare les positives des perles hors tableau de bord", () => {
    expect(filterPearls(list, { ...all, tone: "positive" }).map((p) => p.id)).toEqual(["p"]);
    expect(filterPearls(list, { ...all, tone: "other" }).map((p) => p.id)).toEqual(["o"]);
  });

  it("filtre par source", () => {
    expect(filterPearls(list, { ...all, source: "notion" }).map((p) => p.id)).toEqual(["o"]);
  });

  it("cherche sans tenir compte de la casse, dans le message, l'auteur et la traduction", () => {
    expect(filterPearls(list, { ...all, search: "  cpf " }).map((p) => p.id)).toEqual(["o"]);
    expect(filterPearls(list, { ...all, search: "ODILE" }).map((p) => p.id)).toEqual(["p", "o"]);
    expect(filterPearls([{ ...base, message_fr: "Merci beaucoup" }], { ...all, search: "beaucoup" })).toHaveLength(1);
    expect(filterPearls(list, { ...all, search: "introuvable" })).toEqual([]);
  });
});
