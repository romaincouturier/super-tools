import { describe, it, expect } from "vitest";
import { normalizeTags, resolveColumn, validateNewCard, validateToc, prepareNewsletter } from "./editorial-tools.ts";

const COLS = [
  { id: "a", name: "Idées" },
  { id: "b", name: "Diffusion Terminée" },
];

describe("normalizeTags", () => {
  it("lit les deux formats stockés", () => {
    expect(normalizeTags(["Produit", " IA "])).toEqual(["Produit", "IA"]);
    expect(normalizeTags('["événement"]')).toEqual(["événement"]);
    expect(normalizeTags(null)).toEqual([]);
  });
});

describe("resolveColumn", () => {
  it("prend Idées par défaut et ignore accents et casse", () => {
    expect(resolveColumn(COLS).id).toBe("a");
    expect(resolveColumn(COLS, "diffusion terminee").id).toBe("b");
  });
  it("refuse une colonne inconnue en listant les valides", () => {
    expect(() => resolveColumn(COLS, "Publié")).toThrow(/Idées, Diffusion Terminée/);
  });
});

describe("validateNewCard", () => {
  it("exige un titre et un type connu", () => {
    expect(() => validateNewCard({})).toThrow(/title/);
    expect(() => validateNewCard({ title: "x", card_type: "video" })).toThrow(/card_type/);
    expect(validateNewCard({ title: " T ", tags: ["a", "a", ""] })).toMatchObject({ title: "T", tags: ["a"], card_type: "article" });
  });
});

describe("validateToc", () => {
  it("conserve l'ordre et mélange cartes existantes et nouvelles", () => {
    const toc = validateToc([{ card_id: "2" }, { title: "Nouveau" }, { card_id: "1" }]);
    expect(toc.map((t) => t.card_id ?? t.title)).toEqual(["2", "Nouveau", "1"]);
  });
  it("refuse les doublons et les entrées vides", () => {
    expect(() => validateToc([{ card_id: "1" }, { card_id: "1" }])).toThrow(/twice/);
    expect(() => validateToc([{}])).toThrow(/items\[0\]/);
    expect(() => validateToc([])).toThrow();
  });
});

describe("prepareNewsletter", () => {
  it("refuse de modifier une newsletter envoyée", async () => {
    const fake = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "n", status: "sent" }, error: null }) }) }),
      }),
    };
    await expect(prepareNewsletter(fake as never, { newsletter_id: "n", items: [{ card_id: "1" }] }))
      .rejects.toThrow(/already been sent/);
  });
});
