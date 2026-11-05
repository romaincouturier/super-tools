import { describe, expect, it } from "vitest";
import type { MissionPage } from "@/hooks/useMissions";
import { htmlToPlainText, normalizeForSearch, searchMissionPages } from "./missionPageSearch";

function page(overrides: Partial<MissionPage>): MissionPage {
  return {
    id: "p1",
    mission_id: "m1",
    parent_page_id: null,
    activity_id: null,
    title: "Sans titre",
    content: null,
    icon: null,
    position: 0,
    is_expanded: false,
    page_type: "page",
    is_deliverable: false,
    comments_enabled: false,
    created_at: "2026-11-05T10:00:00Z",
    updated_at: "2026-11-05T10:00:00Z",
    ...overrides,
  };
}

describe("Recherche dans les pages d'une mission", () => {
  it("trouve une page par son titre, sans distinction de casse ni d'accents", () => {
    const pages = [page({ id: "a", title: "Compte rendu de réunion" })];
    expect(searchMissionPages(pages, "COMPTE RENDU").matchIds.has("a")).toBe(true);
    expect(searchMissionPages(pages, "reunion").matchIds.has("a")).toBe(true);
    expect(searchMissionPages(pages, "réunion").matchIds.has("a")).toBe(true);
  });

  it("trouve une page dans son contenu HTML, pas dans les balises", () => {
    const pages = [
      page({ id: "a", title: "Notes", content: "<p>Le <strong>budget</strong> prévisionnel est de 12 000 €</p>" }),
      page({ id: "b", title: "Autre", content: "<p>Rien à voir</p>" }),
    ];
    const result = searchMissionPages(pages, "budget prev");
    expect(result.matchIds.has("a")).toBe(true);
    expect(result.matchIds.has("b")).toBe(false);
    expect(searchMissionPages(pages, "strong").matchIds.size).toBe(0);
  });

  it("garde visibles les parents d'une page trouvée, sans les compter comme correspondance", () => {
    const pages = [
      page({ id: "racine", title: "Livrables" }),
      page({ id: "enfant", parent_page_id: "racine", title: "Facture" }),
      page({ id: "frere", parent_page_id: "racine", title: "Compte rendu" }),
    ];
    const result = searchMissionPages(pages, "facture");
    expect(result.matchIds).toEqual(new Set(["enfant"]));
    expect(result.visibleIds).toEqual(new Set(["racine", "enfant"]));
  });

  it("ne renvoie aucune correspondance pour un terme absent ou vide", () => {
    const pages = [page({ id: "a", title: "Réunion", content: "<p>Compte rendu</p>" })];
    expect(searchMissionPages(pages, "absent").matchIds.size).toBe(0);
    expect(searchMissionPages(pages, "absent").visibleIds.size).toBe(0);
    expect(searchMissionPages(pages, "   ").matchIds.size).toBe(0);
  });

  it("ignore le script et normalise le texte du contenu", () => {
    expect(htmlToPlainText("<p>Bonjour<br>la team</p>")).toBe("Bonjour la team");
    expect(htmlToPlainText("<p>1 &amp; 2 &#39;ok&#39;</p>")).toBe("1 & 2 'ok'");
    expect(normalizeForSearch("  Café   CRÈME ")).toBe("cafe creme");
  });
});
