import { describe, expect, it } from "vitest";
import {
  allTexts,
  buildTedSearchBody,
  fetchPageWithRetry,
  firstText,
  mapTedNotice,
  noticesOf,
  tedNoticeUrl,
  walkTedPages,
} from "./ted.ts";

/**
 * Le contrat de transport de l'API TED n'a pas pu être vérifié à l'écriture :
 * ces tests figent donc ce qui est SOUS NOTRE CONTRÔLE — la construction de la
 * requête et la lecture défensive d'un avis — et pas la forme exacte de la
 * réponse, que seule la sonde tranchera. Les deux formes testées ci-dessous
 * sont les deux hypothèses plausibles : une réponse aplatie par champ demandé,
 * et un avis eForms complet.
 */

describe("buildTedSearchBody", () => {
  it("combine pays, sujet et date en une requête", () => {
    const body = buildTedSearchBody({
      countries: ["BE", "LU"],
      cpvCodes: ["80511000"],
      keywords: ["facilitation graphique"],
      since: "2026-06-01",
    });
    const query = body.query as string;
    expect(query).toContain("buyer-country=BE OR buyer-country=LU");
    expect(query).toContain("classification-cpv=80511000");
    expect(query).toContain('FT~"facilitation graphique"');
    expect(query).toContain("publication-date>=20260601");
    // Pays ET sujet : sans le ET, la requête ramènerait toute l'Europe.
    expect(query).toContain(") AND (");
  });

  it("neutralise les guillemets d'un mot-clé", () => {
    const body = buildTedSearchBody({
      countries: ["BE"],
      cpvCodes: [],
      keywords: ['co"construction'],
      since: "2026-06-01",
    });
    expect(body.query).toContain('FT~"coconstruction"');
  });

  // Deux plafonds documentés : 250 avis par page, et avis × champs <= 10 000.
  it("respecte les plafonds de pagination documentés", () => {
    const body = buildTedSearchBody({
      countries: ["BE"],
      cpvCodes: [],
      keywords: ["facilitation"],
      since: "2026-06-01",
    });
    const limit = body.limit as number;
    const fields = body.fields as string[];
    expect(limit).toBeLessThanOrEqual(250);
    expect(limit * fields.length).toBeLessThanOrEqual(10_000);
    // Mode itération : pas de plafond de 15 000 avis, et pas de doublon si le
    // TED publie pendant le parcours.
    expect(body.paginationMode).toBe("ITERATION");
    // Le jeton est absent au premier appel : c'est ce qui demande la 1re page.
    expect(body.iterationNextToken).toBeUndefined();
  });

  it("joint le jeton d'itération à partir de la deuxième page", () => {
    const body = buildTedSearchBody({
      countries: ["BE"],
      cpvCodes: [],
      keywords: ["facilitation"],
      since: "2026-06-01",
      iterationNextToken: "jeton-123",
    });
    expect(body.iterationNextToken).toBe("jeton-123");
  });

  it("omet la date quand elle est illisible plutôt que d'envoyer une requête fausse", () => {
    const body = buildTedSearchBody({
      countries: ["BE"],
      cpvCodes: ["80511000"],
      keywords: [],
      since: "date inconnue",
    });
    expect(body.query).not.toContain("publication-date");
  });
});

describe("firstText / allTexts", () => {
  it("préfère le français sur un champ multilingue", () => {
    const node = { "notice-title": { eng: "Graphic facilitation", fra: "Facilitation graphique" } };
    expect(firstText(node, ["notice-title"])).toBe("Facilitation graphique");
  });

  it("retombe sur l'anglais quand le français manque", () => {
    expect(firstText({ title: { eng: "Workshop design" } }, ["notice-title", "title"])).toBe(
      "Workshop design",
    );
  });

  it("trouve la valeur quelle que soit sa profondeur", () => {
    const node = { a: { b: [{ "buyer-name": "Ville de Namur" }] } };
    expect(firstText(node, ["buyer-name"])).toBe("Ville de Namur");
  });

  it("rend null plutôt que de lever quand rien ne correspond", () => {
    expect(firstText({ x: 1 }, ["buyer-name"])).toBeNull();
    expect(allTexts(null, ["buyer-name"])).toEqual([]);
  });
});

describe("mapTedNotice", () => {
  // Hypothèse 1 : réponse aplatie, un champ par colonne demandée.
  it("lit un avis aplati", () => {
    const t = mapTedNotice({
      "publication-number": "00123456-2026",
      "notice-title": { fra: "Ateliers d'intelligence collective" },
      "buyer-name": { fra: "Ville de Namur" },
      "buyer-country": "BEL",
      "classification-cpv": ["79951000", "80511000"],
      "publication-date": "2026-07-15",
      "deadline-receipt-request": "2026-09-01",
      "notice-type": "cn-standard",
    });

    expect(t.source).toBe("ted");
    expect(t.source_ref).toBe("00123456-2026");
    expect(t.objet).toBe("Ateliers d'intelligence collective");
    expect(t.acheteur).toBe("Ville de Namur");
    expect(t.cpv_codes.sort()).toEqual(["79951000", "80511000"]);
    expect(t.code_departement).toEqual(["BEL"]);
    expect(t.datelimitereponse).toBe("2026-09-01");
    // L'URL n'est pas dans la réponse : elle se déduit du numéro plutôt que
    // de laisser la fiche sans lien vers l'avis.
    expect(t.url_avis).toContain("00123456-2026");
    expect(t.full_text).toContain("intelligence collective");
    expect(t.parse_error).toBeNull();
  });

  // Hypothèse 2 : avis eForms complet, le même format que le BOAMP depuis 2024.
  it("lit un avis eForms complet avec le parseur déjà éprouvé sur le BOAMP", () => {
    const t = mapTedNotice({
      EFORMS: {
        ContractNotice: {
          "cbc:ID": "00987654-2026",
          "cac:ProcurementProject": {
            "cbc:Name": "Facilitation graphique de séminaires",
            "cac:MainCommodityClassification": { "cbc:ItemClassificationCode": "79822500" },
          },
          "cac:ProcurementProjectLot": [
            { "cac:ProcurementProject": { "cbc:Name": "Lot 1 : sketchnoting" } },
          ],
        },
      },
    });

    expect(t.source_ref).toBe("00987654-2026");
    expect(t.cpv_codes).toContain("79822500");
    expect(t.decision.lots).toEqual(["Lot 1 : sketchnoting"]);
    expect(t.full_text).toContain("sketchnoting");
  });

  // Un avis illisible doit se compter, pas disparaître.
  it("rend une ligne exploitable sur un avis vide", () => {
    const t = mapTedNotice({});
    expect(t.source_ref).toBe("");
    expect(t.objet).toBeNull();
    expect(t.cpv_codes).toEqual([]);
  });
});

describe("tedNoticeUrl", () => {
  it("construit le lien public depuis le numéro de publication", () => {
    expect(tedNoticeUrl("00123456-2026")).toBe(
      "https://ted.europa.eu/en/notice/-/detail/00123456-2026",
    );
    expect(tedNoticeUrl("  ")).toBeNull();
  });
});

describe("walkTedPages", () => {
  /** Fabrique un faux TED : une page par entrée, le jeton enchaîne les pages. */
  function fakeTed(pages: Array<{ status?: number; notices?: unknown[]; next?: string | null }>) {
    const calls: Array<string | null> = [];
    let index = 0;
    return {
      calls,
      fetchPage: (token: string | null) => {
        calls.push(token);
        const page = pages[index++] ?? { notices: [] };
        return Promise.resolve({
          status: page.status ?? 200,
          payload: { notices: page.notices ?? [], iterationNextToken: page.next ?? null },
        });
      },
    };
  }

  it("enchaîne les pages jusqu'à épuisement du jeton", async () => {
    const ted = fakeTed([
      { notices: [{ id: 1 }, { id: 2 }], next: "t1" },
      { notices: [{ id: 3 }], next: "t2" },
      { notices: [{ id: 4 }], next: null },
    ]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 100, maxPages: 10 });
    expect(r.notices).toHaveLength(4);
    expect(r.pages).toBe(3);
    expect(r.truncated).toBe(false);
    expect(r.error).toBeNull();
    // Premier appel sans jeton, puis les jetons rendus par l'API.
    expect(ted.calls).toEqual([null, "t1", "t2"]);
  });

  it("s'arrête à la première page quand il n'y a pas de jeton", async () => {
    const ted = fakeTed([{ notices: [{ id: 1 }], next: null }]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 100, maxPages: 10 });
    expect(r.pages).toBe(1);
    expect(ted.calls).toEqual([null]);
  });

  // Le défaut le plus coûteux d'un connecteur est celui qui ne se voit pas :
  // une page en échec au milieu du parcours laissait passer une
  // synchronisation « réussie » à laquelle il manquait la moitié du flux.
  it("remonte une page en échec au lieu de la taire", async () => {
    // 4 pages 503 = appel initial + 3 retries ; fetchPageWithRetry abandonne
    // et walkTedPages propage le statut.
    const ted = fakeTed([
      { notices: [{ id: 1 }], next: "t1" },
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 503 },
    ]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 100, maxPages: 10 });
    expect(r.notices).toHaveLength(1);
    expect(r.error).toContain("503");
    expect(r.truncated).toBe(true);
  });

  it("remonte un échec dès la première page", async () => {
    const ted = fakeTed([{ status: 400 }]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 100, maxPages: 10 });
    expect(r.notices).toEqual([]);
    expect(r.error).toContain("400");
  });

  it("s'arrête au plafond d'avis et le signale", async () => {
    const ted = fakeTed([
      { notices: [{ id: 1 }, { id: 2 }], next: "t1" },
      { notices: [{ id: 3 }], next: "t2" },
    ]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 2, maxPages: 10 });
    expect(r.notices).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.error).toBeNull();
  });

  // Un jeton qui ne s'épuise jamais boucle à l'infini : le plafond de pages
  // est ce qui empêche la fonction de tourner jusqu'au timeout.
  it("s'arrête au plafond de pages sur un jeton qui ne s'épuise pas", async () => {
    let n = 0;
    const r = await walkTedPages({
      fetchPage: () => {
        n++;
        return Promise.resolve({
          status: 200,
          payload: { notices: [{ id: n }], iterationNextToken: "toujours" },
        });
      },
      maxRecords: 1000,
      maxPages: 3,
    });
    expect(r.pages).toBe(3);
    expect(r.truncated).toBe(true);
    expect(n).toBe(3);
  });

  it("s'arrête sur une page vide sans crier à l'erreur", async () => {
    const ted = fakeTed([{ notices: [{ id: 1 }], next: "t1" }, { notices: [], next: "t2" }]);
    const r = await walkTedPages({ fetchPage: ted.fetchPage, maxRecords: 100, maxPages: 10 });
    expect(r.notices).toHaveLength(1);
    expect(r.error).toBeNull();
    expect(r.truncated).toBe(false);
  });
});

describe("noticesOf", () => {
  it("accepte les enveloppes plausibles et le tableau nu", () => {
    expect(noticesOf({ notices: [1] })).toEqual([1]);
    expect(noticesOf({ results: [2] })).toEqual([2]);
    expect(noticesOf({ content: [3] })).toEqual([3]);
    expect(noticesOf([4])).toEqual([4]);
    expect(noticesOf(null)).toEqual([]);
    expect(noticesOf({ autre: "chose" })).toEqual([]);
  });
});

describe("filtre sujet du TED : mots-clés, CPV propre au TED", () => {
  // Le TED se repère sur les mots-clés, sa liste CPV étant vide par défaut :
  // les codes de formation du BOAMP inondent à l'échelle de l'Europe.
  it("construit une requête mots-clés seuls quand la liste CPV est vide", () => {
    const body = buildTedSearchBody({
      countries: [],
      cpvCodes: [],
      keywords: ["graphic facilitation", "collective intelligence"],
      since: "2026-06-01",
    });
    const query = body.query as string;
    expect(query).not.toContain("classification-cpv");
    expect(query).not.toContain("buyer-country");
    expect(query).toContain('FT~"graphic facilitation"');
    expect(query).toContain('FT~"collective intelligence"');
  });

  // Ni la géographie ni la langue ne filtrent : sans pays, aucune clause pays.
  it("n'ajoute aucune clause de pays quand la liste est vide", () => {
    const body = buildTedSearchBody({
      countries: [],
      cpvCodes: [],
      keywords: ["facilitation"],
      since: "2026-06-01",
    });
    expect(body.query).not.toContain("buyer-country");
  });

  // Une liste CPV propre au TED est utilisable si on veut resserrer autrement.
  it("intègre les CPV propres au TED quand la liste est renseignée", () => {
    const body = buildTedSearchBody({
      countries: [],
      cpvCodes: ["79952000"],
      keywords: ["facilitation"],
      since: "2026-06-01",
    });
    expect(body.query).toContain("classification-cpv=79952000");
  });
});

describe("walkTedPages : première page fournie", () => {
  it("ne redemande pas une page déjà en main", async () => {
    const calls: Array<string | null> = [];
    const r = await walkTedPages({
      firstPage: { status: 200, payload: { notices: [{ id: 1 }], iterationNextToken: "t1" } },
      fetchPage: (token) => {
        calls.push(token);
        return Promise.resolve({
          status: 200,
          payload: { notices: [{ id: 2 }], iterationNextToken: null },
        });
      },
      maxRecords: 100,
      maxPages: 10,
    });
    expect(r.notices).toHaveLength(2);
    // Le premier appel réseau porte le jeton : la page 1 n'a pas été refaite.
    expect(calls).toEqual(["t1"]);
  });

  it("remonte l'échec d'une première page fournie", async () => {
    const r = await walkTedPages({
      firstPage: { status: 500, payload: null },
      fetchPage: () => Promise.reject(new Error("ne doit pas être appelé")),
      maxRecords: 100,
      maxPages: 10,
    });
    expect(r.error).toContain("500");
    expect(r.notices).toEqual([]);
  });
});

describe("fetchPageWithRetry", () => {
  it("réussit au premier appel quand l'API répond 200", async () => {
    const page = await fetchPageWithRetry(
      () => Promise.resolve({ status: 200, payload: { ok: true } }),
      null,
      "page 1",
    );
    expect(page.status).toBe(200);
    expect(page.payload).toEqual({ ok: true });
  });

  it("réessaie sur un 429 puis récupère la page suivante", async () => {
    let calls = 0;
    const page = await fetchPageWithRetry(
      () => {
        calls++;
        if (calls === 1) return Promise.resolve({ status: 429, payload: null });
        return Promise.resolve({ status: 200, payload: { notices: [{ id: 1 }] } });
      },
      "t1",
      "page 2",
    );
    expect(calls).toBe(2);
    expect(page.status).toBe(200);
  });

  it("échoue après 3 retries sur des 429 successifs", async () => {
    let calls = 0;
    const page = await fetchPageWithRetry(
      () => {
        calls++;
        return Promise.resolve({ status: 429, payload: null });
      },
      "t1",
      "page 2",
    );
    expect(calls).toBe(4); // appel initial + 3 retries
    expect(page.status).toBe(429);
  });

  it("ne retry pas un 400", async () => {
    let calls = 0;
    const page = await fetchPageWithRetry(
      () => {
        calls++;
        return Promise.resolve({ status: 400, payload: { error: "bad request" } });
      },
      null,
      "page 1",
    );
    expect(calls).toBe(1);
    expect(page.status).toBe(400);
  });
});

describe("walkTedPages avec retry", () => {
  it("reprend le parcours après un 429 passager", async () => {
    let calls: Array<string | null> = [];
    let attempts = 0;
    const r = await walkTedPages({
      fetchPage: (token) => {
        calls.push(token);
        if (token === "t1" && attempts === 0) {
          attempts++;
          return Promise.resolve({ status: 429, payload: null });
        }
        return Promise.resolve({
          status: 200,
          payload: {
            notices: [{ id: token ?? "first" }],
            iterationNextToken: token === null ? "t1" : null,
          },
        });
      },
      maxRecords: 100,
      maxPages: 10,
    });
    expect(r.notices).toHaveLength(2);
    expect(r.error).toBeNull();
    expect(r.truncated).toBe(false);
    expect(calls).toEqual([null, "t1", "t1"]);
  });
});
