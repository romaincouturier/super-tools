import { describe, expect, it } from "vitest";
import {
  allTexts,
  buildTedSearchBody,
  firstText,
  mapTedNotice,
  tedNoticeUrl,
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
