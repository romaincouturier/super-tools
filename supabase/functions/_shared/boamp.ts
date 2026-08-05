/**
 * Lecture du flux BOAMP (open data DILA, plateforme Opendatasoft).
 *
 * Deux pièges vérifiés sur les données réelles, qui justifient tout ce fichier :
 *
 * 1. `donnees` a DEUX structures incompatibles selon l'âge de l'avis. Les avis
 *    anciens dérivent du XML BOAMP (`{IDENTITE, OBJET, PROCEDURE, ...}` en
 *    majuscules), les récents sont au format européen eForms
 *    (`{EFORMS: {ContractNotice: {"cac:...", "cbc:..."}}}`). Le champ
 *    `source_schema` les distingue. Un parseur écrit pour l'un renvoie du vide
 *    sur l'autre, sans erreur.
 *
 * 2. `datelimitereponse` est souvent NULL alors que l'avis a bien une date
 *    limite : elle n'existe alors que dans `donnees`. Trier sur la colonne à
 *    plat perdrait une bonne partie des avis, silencieusement.
 *
 * Tout ce qui est extrait ici l'est de façon défensive : un champ absent donne
 * null, jamais une exception. Ce qui échoue au parsing est reporté dans
 * `parse_error` plutôt qu'avalé — sinon on ne saurait jamais combien d'avis
 * passent à côté du filtre.
 */

export const BOAMP_BASE =
  "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp";

import {
  asArray,
  collectCpv,
  decisionFromEforms,
  deepFind,
  dig,
  numberOf,
  textOf,
  type Json,
  type TenderDecisionInfo,
} from "./eforms.ts";

export type { TenderDecisionInfo };

/**
 * Prose de l'avis : titre, descripteurs métier, objet complet, intitulés des
 * lots et critères. C'est là-dessus que les mots-clés sont cherchés, et non
 * sur le seul titre.
 *
 * Volontairement pas le JSON brut entier : il contient les clauses
 * administratives, les adresses de tribunal et les conditions de paiement, où
 * n'importe quel mot finit par apparaître.
 */
function fullTextOf(record: Json, donnees: Json, decision: TenderDecisionInfo): string {
  const parts: Array<string | null> = [
    textOf(record?.objet),
    ...asArray(record?.descripteur_libelle).map((v: Json) => textOf(v)),
    ...deepFind(donnees, "OBJET_COMPLET").map((v) => textOf(v)),
    ...deepFind(donnees, "TITRE_MARCHE").map((v) => textOf(v)),
    ...deepFind(donnees, "cbc:Description").map((v) => textOf(v)),
    ...decision.lots,
    ...decision.criteres.map((c) => c.libelle),
  ];
  return parts.filter(Boolean).join(" ");
}

/** Ligne normalisée, prête pour `tender_opportunities`. */
export interface NormalizedTender {
  source: string;
  source_ref: string;
  url_avis: string | null;
  objet: string | null;
  acheteur: string | null;
  nature: string | null;
  type_marche: string | null;
  famille_libelle: string | null;
  code_departement: string[];
  cpv_codes: string[];
  dateparution: string | null;
  datelimitereponse: string | null;
  /** Éléments d'aide à la décision, extraits des deux schémas. */
  decision: TenderDecisionInfo;
  /** Prose de l'avis, sur laquelle porte la recherche par mots-clés. */
  full_text: string;
  raw: Json;
  parse_error: string | null;
}


// ── Utilitaires de lecture défensive ─────────────────────────


// ── Extraction des éléments de décision ──────────────────────

function decisionFromLegacy(donnees: Json): TenderDecisionInfo {
  const objet = dig(donnees, "OBJET");
  const lotsNode = asArray(dig(objet, "LOTS", "LOT"));

  const criteres: Array<{ libelle: string; poids: number | null }> = [];
  const pushCriteres = (node: Json) => {
    // Forme pondérée globale.
    for (const c of asArray(dig(node, "CRITERES_PONDERES", "CRITERE"))) {
      const libelle = textOf(c);
      if (libelle) criteres.push({ libelle, poids: numberOf(dig(c, "@POIDS")) });
    }
    // Forme qualité + prix, utilisée par les avis européens récents.
    for (const c of asArray(dig(node, "CRITERES_QUALITE", "CRITERE"))) {
      const libelle = textOf(c);
      if (libelle) criteres.push({ libelle, poids: numberOf(dig(c, "@POIDS")) });
    }
    const prix = dig(node, "CRITERES_PRIX");
    if (prix !== undefined) {
      const poids = numberOf(dig(prix, "POIDS")) ?? numberOf(prix);
      if (poids !== null) criteres.push({ libelle: "Prix", poids });
    }
  };
  pushCriteres(dig(donnees, "PROCEDURE", "CRITERES_ATTRIBUTION"));
  for (const lot of lotsNode) pushCriteres(dig(lot, "CRITERES_ATTRIBUTION"));

  const montant =
    numberOf(dig(objet, "CARACTERISTIQUES", "VALEUR_TOTALE")) ??
    numberOf(dig(objet, "CARACTERISTIQUES", "VALEUR_MAX")) ??
    numberOf(dig(objet, "ACCORD_CADRE", "VALEUR_MAX")) ??
    lotsNode.reduce<number | null>((sum, lot) => {
      const v = numberOf(dig(lot, "VALEUR"));
      return v === null ? sum : (sum ?? 0) + v;
    }, null);

  const dureeMois =
    numberOf(dig(objet, "DUREE_DELAI", "DUREE_MOIS")) ??
    numberOf(dig(lotsNode[0], "DUREE_MOIS"));

  // BOAMP encode les booléens par la présence d'une clé suffixée _OUI / _NON.
  const hasKey = (node: Json, key: string) =>
    node && typeof node === "object" && key in node;
  let reconductible: boolean | null = null;
  for (const node of [objet, dig(objet, "CARACTERISTIQUES"), ...lotsNode]) {
    if (hasKey(node, "RENOUVELLEMENT_OUI") || hasKey(dig(node, "RECONDUCTIONS"), "OUI")) {
      reconductible = true;
      break;
    }
    if (hasKey(node, "RENOUVELLEMENT_NON") || hasKey(dig(node, "RECONDUCTIONS"), "NON")) {
      reconductible = false;
    }
  }

  const lots = lotsNode
    .map((lot) => textOf(dig(lot, "INTITULE")) ?? textOf(dig(lot, "DESCRIPTION")))
    .filter((v): v is string => !!v);

  let urlDce = textOf(dig(donnees, "IDENTITE", "URL_DOCUMENT"));
  if (!urlDce) {
    for (const adresse of asArray(
      dig(donnees, "RENSEIGNEMENTS_COMPLEMENTAIRES", "ADRESSES_COMPLEMENTAIRES", "ADRESSE"),
    )) {
      const url = textOf(dig(adresse, "URL"));
      if (url) {
        urlDce = url;
        break;
      }
    }
  }

  return {
    titulaire: null,
    montant,
    duree_mois: dureeMois,
    reconductible,
    criteres,
    lots,
    url_dce: urlDce,
    contact_email: textOf(dig(donnees, "IDENTITE", "MEL")),
    ville: textOf(dig(donnees, "IDENTITE", "VILLE")),
  };
}


/**
 * Date limite de remise des offres.
 * La colonne à plat est souvent nulle : on retombe sur `donnees`, où la date
 * existe presque toujours, sous l'une des trois clés selon le formulaire.
 */
function deadlineOf(record: Json, donnees: Json): string | null {
  const flat = textOf(record?.datelimitereponse);
  if (flat) return flat;

  const legacy =
    textOf(dig(donnees, "CONDITION_DELAI", "RECEPT_OFFRES")) ??
    textOf(dig(donnees, "CONDITION_DELAI", "RECEPT_CANDIDAT"));
  if (legacy) return legacy;

  const notice = dig(donnees, "EFORMS", "ContractNotice");
  for (const lot of asArray(dig(notice, "cac:ProcurementProjectLot"))) {
    const period = dig(lot, "cac:TenderingProcess", "cac:TenderSubmissionDeadlinePeriod");
    const date = textOf(dig(period, "cbc:EndDate"));
    if (date) {
      const time = textOf(dig(period, "cbc:EndTime"));
      // cbc:EndDate porte déjà le décalage horaire (« 2024-08-26+02:00 »).
      return time ? `${date.slice(0, 10)}T${time}` : date;
    }
  }
  return null;
}

// ── Normalisation d'un enregistrement ────────────────────────

export function mapBoampRecord(record: Json): NormalizedTender {
  let donnees: Json = null;
  let parseError: string | null = null;
  try {
    donnees = typeof record?.donnees === "string" ? JSON.parse(record.donnees) : record?.donnees;
  } catch (e) {
    parseError = `donnees illisible : ${e instanceof Error ? e.message : "erreur"}`;
  }

  const isEforms = !!dig(donnees, "EFORMS");
  const decision = donnees
    ? isEforms
      ? decisionFromEforms(donnees)
      : decisionFromLegacy(donnees)
    : {
      titulaire: null,
      montant: null,
      duree_mois: null,
      reconductible: null,
      criteres: [],
      lots: [],
      url_dce: null,
      contact_email: null,
      ville: null,
    };
  // `titulaire` est un TABLEAU dans le flux, un avis d'attribution pouvant en
  // désigner plusieurs. Passé tel quel à textOf, il rendait null : le signal de
  // décision numéro un de la spec était perdu sur tous les avis d'attribution.
  const titulaires = asArray(record?.titulaire)
    .map((t: Json) => textOf(t))
    .filter((v): v is string => !!v);
  decision.titulaire = titulaires.length ? titulaires.join(", ") : null;


  const cpv = new Set<string>();
  collectCpv(donnees, cpv);

  return {
    source: "boamp",
    source_ref: String(record?.idweb ?? "").trim(),
    url_avis: textOf(record?.url_avis),
    objet: textOf(record?.objet),
    acheteur: textOf(record?.nomacheteur),
    nature: textOf(record?.nature),
    // type_marche est un TABLEAU dans le flux, pas une chaîne.
    type_marche: asArray(record?.type_marche).map(String)[0] ?? null,
    famille_libelle: textOf(record?.famille_libelle),
    code_departement: asArray(record?.code_departement).map(String),
    cpv_codes: [...cpv],
    dateparution: textOf(record?.dateparution),
    datelimitereponse: deadlineOf(record, donnees),
    decision,
    full_text: fullTextOf(record, donnees, decision),
    raw: record,
    parse_error: parseError,
  };
}

// ── Construction des requêtes ────────────────────────────────

/**
 * `where` ODSQL. Une chaîne entre guillemets doubles seule déclenche la
 * recherche plein texte sur tous les champs, `donnees` compris : c'est ainsi
 * qu'on atteint les CPV, qui ne sont pas une colonne à plat.
 */
export function buildBoampWhere(opts: {
  natures: string[];
  since: string;
  cpvCodes: string[];
  keywords: string[];
}): string {
  const natures = opts.natures.map((n) => `nature="${n}"`).join(" OR ");
  // Plein texte et non `search(objet, …)` : mesuré sur deux mois d'ingestion,
  // le titre seul ramenait 1 avis sur « facilitation » et 0 sur « intelligence
  // collective », alors que ces termes vivent dans la description ou dans
  // l'intitulé d'un lot. Le marché DITP, dont le lot 4 s'appelle
  // « Intelligence collective et facilitation », passait entièrement à côté.
  const terms = [
    ...opts.cpvCodes.map((c) => `"${c}"`),
    ...opts.keywords.map((k) => `"${k.replace(/"/g, "")}"`),
  ];
  return `(${natures}) AND dateparution >= date'${opts.since}' AND (${terms.join(" OR ")})`;
}

export function boampExportUrl(where: string): string {
  return `${BOAMP_BASE}/exports/json?where=${encodeURIComponent(where)}`;
}
