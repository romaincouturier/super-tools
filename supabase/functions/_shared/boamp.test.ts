/**
 * Fixtures extraites du flux BOAMP réel (interrogé le 03/08/2026), réduites
 * aux champs utiles. Elles couvrent les trois formes rencontrées :
 *   - schéma historique, CPV en objet unique, critères pondérés globaux
 *   - schéma historique alloti, CPV en tableau, critères qualité + prix,
 *     `datelimitereponse` NULL alors que la date existe dans `donnees`
 *   - schéma européen eForms, structure entièrement différente
 */
import { describe, expect, it } from "vitest";
import { buildBoampWhere, mapBoampRecord } from "./boamp.ts";

const LEGACY_SIMPLE = {
  idweb: "15-35076",
  objet: "formation des agents de la bibliothèque publique d'information",
  nomacheteur: "Bibliothèque publique d'information",
  nature: "APPEL_OFFRE",
  titulaire: null,
  type_marche: ["SERVICES"],
  famille_libelle: "Marchés européens",
  code_departement: ["75"],
  dateparution: "2015-03-09",
  datelimitereponse: "2015-04-08T17:00:00+00:00",
  url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:15-35076",
  source_schema: "Boamp_v230.xsd",
  donnees: JSON.stringify({
    IDENTITE: { DENOMINATION: "Bpi", VILLE: "Paris cedex 04", MEL: "servicejuridique@bpi.fr" },
    OBJET: {
      TITRE_MARCHE: "Formation Synapse 2015",
      CPV: { PRINCIPAL: "80533100" },
      ACCORD_CADRE: { VALEUR_MAX: { "@DEVISE": "EUR", "#text": "20000" } },
      CARACTERISTIQUES: {
        VALEUR_MAX: { "@DEVISE": "EUR", "#text": "20000" },
        RECONDUCTIONS: { NON: "" },
      },
      DUREE_DELAI: { DUREE_MOIS: "12" },
      DIV_EN_LOTS: { NON: "" },
    },
    PROCEDURE: {
      CRITERES_ATTRIBUTION: {
        CRITERES_PONDERES: {
          CRITERE: [
            { "@POIDS": "60", "#text": "Valeur technique" },
            { "@POIDS": "40", "#text": "Prix" },
          ],
        },
      },
    },
    CONDITION_DELAI: { RECEPT_OFFRES: "2015-04-08T18:00:00+01:00" },
  }),
};

const LEGACY_ALLOTI = {
  idweb: "23-147627",
  objet: "Prestations de facilitation graphique et de création de supports visuels",
  nomacheteur: "Communauté Urbaine de Dunkerque",
  nature: "APPEL_OFFRE",
  titulaire: null,
  type_marche: ["SERVICES"],
  famille_libelle: "Marchés européens",
  code_departement: ["59"],
  dateparution: "2023-10-22",
  // Volontairement nul : la vraie date n'existe que dans `donnees`.
  datelimitereponse: null,
  url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:23-147627",
  source_schema: "None",
  donnees: JSON.stringify({
    IDENTITE: {
      DENOMINATION: "Communauté Urbaine de Dunkerque",
      VILLE: "Dunkerque cedex 1",
      MEL: "commandepublique@cud.fr",
      URL_DOCUMENT: "https://www.marches-securises.fr/",
    },
    OBJET: {
      TITRE_MARCHE: "Prestations de facilitation graphique",
      CPV: { PRINCIPAL: "79822500" },
      DIV_EN_LOTS: { NON: "" },
      LOTS: {
        LOT: {
          DESCRIPTION: "Prestations de facilitation graphique et de création de supports visuels",
          CPV: { PRINCIPAL: "79822500" },
          CRITERES_ATTRIBUTION: {
            CRITERES_QUALITE: { CRITERE: { "@POIDS": "70", "#text": "Valeur technique" } },
            CRITERES_PRIX: { POIDS: "30" },
          },
          DUREE_MOIS: "48",
          RENOUVELLEMENT_NON: "",
        },
      },
    },
    CONDITION_DELAI: { RECEPT_OFFRES: "2023-11-22T12:00:00+01:00" },
  }),
};

const EFORMS = {
  idweb: "24-79342",
  objet: "REALISATION DE PRESTATIONS AUTOUR DE L'INNOVATION ET DE LA FACILITATION",
  nomacheteur: "CAISSE NATIONALE DE L'ASSURANCE MALADIE",
  nature: "APPEL_OFFRE",
  titulaire: null,
  type_marche: ["SERVICES"],
  famille_libelle: "Marchés européens",
  code_departement: ["75"],
  dateparution: "2024-07-07",
  datelimitereponse: "2024-08-26T12:00:00+00:00",
  url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:24-79342",
  source_schema: "3.2.5",
  donnees: JSON.stringify({
    EFORMS: {
      ContractNotice: {
        "ext:UBLExtensions": {
          "ext:UBLExtension": {
            "ext:ExtensionContent": {
              "efext:EformsExtension": {
                "efac:Organizations": {
                  "efac:Organization": [
                    {
                      "efac:Company": {
                        "cac:Contact": { "cbc:ElectronicMail": "greffe.ta-paris@juradm.fr" },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        "cac:ContractingParty": {
          "cac:Party": { "cac:PostalAddress": { "cbc:CityName": "Paris" } },
        },
        "cac:ProcurementProject": {
          "cbc:Name": { "@languageID": "FRA", "#text": "PRESTATIONS INNOVATION ET FACILITATION" },
          "cac:RequestedTenderTotal": {
            "cbc:EstimatedOverallContractAmount": { "@currencyID": "EUR", "#text": "10458333.33" },
          },
          "cac:MainCommodityClassification": {
            "cbc:ItemClassificationCode": { "@listName": "cpv", "#text": "79411000" },
          },
        },
        "cac:ProcurementProjectLot": {
          "cbc:ID": { "#text": "LOT-0001" },
          "cac:TenderingTerms": {
            "cac:CallForTendersDocumentReference": {
              "cac:Attachment": {
                "cac:ExternalReference": { "cbc:URI": "https://www.marches-publics.gouv.fr/" },
              },
            },
          },
          "cac:ProcurementProject": {
            "cbc:Name": { "#text": "Prestations innovation et facilitation" },
            "cac:MainCommodityClassification": {
              "cbc:ItemClassificationCode": { "@listName": "cpv", "#text": "79411000" },
            },
          },
        },
      },
    },
  }),
};

describe("mapBoampRecord — schéma historique", () => {
  const t = mapBoampRecord(LEGACY_SIMPLE);

  it("normalise les champs à plat", () => {
    expect(t.source).toBe("boamp");
    expect(t.source_ref).toBe("15-35076");
    expect(t.acheteur).toBe("Bibliothèque publique d'information");
    // type_marche arrive en TABLEAU dans le flux, pas en chaîne.
    expect(t.type_marche).toBe("SERVICES");
    expect(t.code_departement).toEqual(["75"]);
    expect(t.parse_error).toBeNull();
  });

  it("extrait le CPV même quand il est un objet unique", () => {
    expect(t.cpv_codes).toEqual(["80533100"]);
  });

  it("extrait les critères pondérés, le montant et la durée", () => {
    expect(t.decision.criteres).toEqual([
      { libelle: "Valeur technique", poids: 60 },
      { libelle: "Prix", poids: 40 },
    ]);
    expect(t.decision.montant).toBe(20000);
    expect(t.decision.duree_mois).toBe(12);
    expect(t.decision.reconductible).toBe(false);
    expect(t.decision.contact_email).toBe("servicejuridique@bpi.fr");
  });
});

describe("mapBoampRecord — schéma historique alloti", () => {
  const t = mapBoampRecord(LEGACY_ALLOTI);

  it("retombe sur donnees quand datelimitereponse est nul", () => {
    expect(LEGACY_ALLOTI.datelimitereponse).toBeNull();
    expect(t.datelimitereponse).toBe("2023-11-22T12:00:00+01:00");
  });

  it("lit les critères qualité et prix portés par le lot", () => {
    expect(t.decision.criteres).toEqual([
      { libelle: "Valeur technique", poids: 70 },
      { libelle: "Prix", poids: 30 },
    ]);
  });

  it("remonte les lots, la durée et l'URL du DCE", () => {
    expect(t.decision.lots).toHaveLength(1);
    expect(t.decision.duree_mois).toBe(48);
    expect(t.decision.url_dce).toBe("https://www.marches-securises.fr/");
    expect(t.decision.reconductible).toBe(false);
  });

  it("extrait le CPV du marché comme du lot, sans doublon", () => {
    expect(t.cpv_codes).toEqual(["79822500"]);
  });
});

describe("mapBoampRecord — schéma eForms", () => {
  const t = mapBoampRecord(EFORMS);

  it("reconnaît la structure européenne et extrait le CPV", () => {
    expect(t.cpv_codes).toEqual(["79411000"]);
    expect(t.parse_error).toBeNull();
  });

  it("extrait le montant, le DCE, le contact et les lots", () => {
    expect(t.decision.montant).toBeCloseTo(10458333.33, 2);
    expect(t.decision.url_dce).toBe("https://www.marches-publics.gouv.fr/");
    expect(t.decision.contact_email).toBe("greffe.ta-paris@juradm.fr");
    expect(t.decision.lots).toEqual(["Prestations innovation et facilitation"]);
    expect(t.decision.ville).toBe("Paris");
  });
});

describe("mapBoampRecord — robustesse", () => {
  it("signale un donnees illisible au lieu de l'avaler", () => {
    const t = mapBoampRecord({ idweb: "99-1", donnees: "{pas du json" });
    expect(t.parse_error).toMatch(/donnees illisible/);
    expect(t.source_ref).toBe("99-1");
    expect(t.cpv_codes).toEqual([]);
  });

  it("ne lève pas sur un enregistrement vide", () => {
    const t = mapBoampRecord({});
    expect(t.source_ref).toBe("");
    expect(t.decision.criteres).toEqual([]);
    expect(t.datelimitereponse).toBeNull();
  });

  it("récupère le titulaire des avis d'attribution", () => {
    const t = mapBoampRecord({ ...LEGACY_SIMPLE, nature: "ATTRIBUTION", titulaire: "Cabinet X" });
    expect(t.decision.titulaire).toBe("Cabinet X");
  });
});

describe("buildBoampWhere", () => {
  it("compose natures, date, CPV plein texte et mots-clés", () => {
    const where = buildBoampWhere({
      natures: ["APPEL_OFFRE", "ATTRIBUTION"],
      since: "2026-08-01",
      cpvCodes: ["79822500", "80530000"],
      keywords: ["facilitation graphique"],
    });
    expect(where).toContain('(nature="APPEL_OFFRE" OR nature="ATTRIBUTION")');
    expect(where).toContain("dateparution >= date'2026-08-01'");
    expect(where).toContain('"79822500" OR "80530000"');
    expect(where).toContain('search(objet, "facilitation graphique")');
  });
});
