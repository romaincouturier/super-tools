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

// deno-lint-ignore no-explicit-any
type Json = any;

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
  raw: Json;
  parse_error: string | null;
}

export interface TenderDecisionInfo {
  /** Titulaire sortant, renseigné sur les avis d'attribution. */
  titulaire: string | null;
  /** Montant annoncé, en euros, ou null. */
  montant: number | null;
  /** Durée du marché en mois. */
  duree_mois: number | null;
  /** Le marché est-il reconductible. */
  reconductible: boolean | null;
  /** Pondération des critères : [{ libelle, poids }]. */
  criteres: Array<{ libelle: string; poids: number | null }>;
  /** Intitulé des lots, vide si marché non alloti. */
  lots: string[];
  /** URL de retrait du dossier de consultation. */
  url_dce: string | null;
  /** Contact de l'acheteur. */
  contact_email: string | null;
  ville: string | null;
}

// ── Utilitaires de lecture défensive ─────────────────────────

/** BOAMP alterne objet unique et tableau pour les mêmes champs. */
function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Descend une suite de clés sans jamais lever. */
function dig(obj: Json, ...path: string[]): Json {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

/**
 * BOAMP encode certaines valeurs en `{"@DEVISE": "EUR", "#text": "20000"}`
 * (attributs XML convertis en JSON) et d'autres en chaîne nue.
 */
function textOf(value: Json): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in value) return textOf(value["#text"]);
  return null;
}

function numberOf(value: Json): number | null {
  const text = textOf(value);
  if (!text) return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Collecte récursive des codes CPV, quel que soit le niveau où ils vivent. */
function collectCpv(node: Json, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectCpv(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    // Schéma historique : { CPV: { PRINCIPAL: "80533100" } } ou tableau.
    if (key === "CPV") {
      for (const entry of asArray(value)) {
        const code = textOf(dig(entry, "PRINCIPAL")) ?? textOf(entry);
        if (code && /^\d{8}$/.test(code)) out.add(code);
      }
      continue;
    }
    // eForms : ItemClassificationCode avec @listName = "cpv".
    if (key === "cbc:ItemClassificationCode") {
      for (const entry of asArray(value)) {
        const code = textOf(entry);
        if (code && /^\d{8}$/.test(code)) out.add(code);
      }
      continue;
    }
    collectCpv(value, out);
  }
}

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

function decisionFromEforms(donnees: Json): TenderDecisionInfo {
  const notice =
    dig(donnees, "EFORMS", "ContractNotice") ??
    dig(donnees, "EFORMS", "ContractAwardNotice") ??
    dig(donnees, "EFORMS");

  const project = dig(notice, "cac:ProcurementProject");
  const lotsNode = asArray(dig(notice, "cac:ProcurementProjectLot"));

  const montant =
    numberOf(dig(project, "cac:RequestedTenderTotal", "cbc:EstimatedOverallContractAmount")) ??
    numberOf(
      dig(
        project,
        "cac:RequestedTenderTotal",
        "ext:UBLExtensions",
        "ext:UBLExtension",
        "ext:ExtensionContent",
        "efext:EformsExtension",
        "efbc:FrameworkMaximumAmount",
      ),
    );

  let urlDce: string | null = null;
  for (const lot of lotsNode) {
    urlDce =
      textOf(
        dig(
          lot,
          "cac:TenderingTerms",
          "cac:CallForTendersDocumentReference",
          "cac:Attachment",
          "cac:ExternalReference",
          "cbc:URI",
        ),
      ) ?? urlDce;
    if (urlDce) break;
  }

  let contact: string | null = null;
  for (const org of asArray(
    dig(
      notice,
      "ext:UBLExtensions",
      "ext:UBLExtension",
      "ext:ExtensionContent",
      "efext:EformsExtension",
      "efac:Organizations",
      "efac:Organization",
    ),
  )) {
    contact = textOf(dig(org, "efac:Company", "cac:Contact", "cbc:ElectronicMail")) ?? contact;
    if (contact) break;
  }

  const lots = lotsNode
    .map((lot) => textOf(dig(lot, "cac:ProcurementProject", "cbc:Name")))
    .filter((v): v is string => !!v);

  return {
    titulaire: null,
    montant,
    duree_mois: null,
    reconductible: null,
    criteres: [],
    lots,
    url_dce: urlDce,
    contact_email: contact,
    ville: textOf(
      dig(notice, "cac:ContractingParty", "cac:Party", "cac:PostalAddress", "cbc:CityName"),
    ),
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
  decision.titulaire = textOf(record?.titulaire);

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
  const terms = [
    ...opts.cpvCodes.map((c) => `"${c}"`),
    ...opts.keywords.map((k) => `search(objet, "${k.replace(/"/g, "")}")`),
  ];
  return `(${natures}) AND dateparution >= date'${opts.since}' AND (${terms.join(" OR ")})`;
}

export function boampExportUrl(where: string): string {
  return `${BOAMP_BASE}/exports/json?where=${encodeURIComponent(where)}`;
}
