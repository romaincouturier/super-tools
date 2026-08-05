/**
 * Lecture défensive d'un avis eForms (UBL européen).
 *
 * Ces utilitaires ne connaissent ni le BOAMP ni le TED : ils lisent une
 * structure JSON dérivée de XML, où le même champ est tantôt un objet, tantôt
 * un tableau, tantôt `{"@ATTR": ..., "#text": ...}`. Deux connecteurs s'en
 * servent, d'où ce fichier plutôt qu'une copie dans chacun.
 *
 * `decisionFromEforms` vit ici pour la même raison : eForms est le format
 * européen, le BOAMP le publie depuis 2024 et le TED ne publie que lui. Un
 * avis TED se lit donc avec le parseur déjà éprouvé sur des avis BOAMP réels.
 *
 * Règle de la maison : un champ absent donne null, jamais une exception.
 */

// deno-lint-ignore no-explicit-any
export type Json = any;

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
  /** Devise du montant : hors de France, ce n'est pas toujours l'euro. */
  devise?: string | null;
  /** Type de procédure tel que codé par la source. */
  procedure?: string | null;
  /** Langue officielle de l'avis (TED). */
  langue?: string | null;
  /** URL de dépôt de l'offre. */
  url_soumission?: string | null;
  /** Site de l'acheteur. */
  site_acheteur?: string | null;
}


/** BOAMP alterne objet unique et tableau pour les mêmes champs. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Descend une suite de clés sans jamais lever. */
export function dig(obj: Json, ...path: string[]): Json {
  let cur = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}


/**
 * Cherche récursivement toutes les valeurs portées par une clé, où qu'elle
 * vive. En eForms, les critères d'attribution et la durée sont tantôt au
 * niveau de la procédure, tantôt au niveau de chaque lot : un chemin fixe
 * rend du vide sur la moitié des avis.
 */
export function deepFind(node: Json, key: string, out: Json[] = []): Json[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) deepFind(item, key, out);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === key) out.push(v);
    else deepFind(v, key, out);
  }
  return out;
}


/**
 * BOAMP encode certaines valeurs en `{"@DEVISE": "EUR", "#text": "20000"}`
 * (attributs XML convertis en JSON) et d'autres en chaîne nue.
 */
export function textOf(value: Json): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in value) return textOf(value["#text"]);
  return null;
}

export function numberOf(value: Json): number | null {
  const text = textOf(value);
  if (!text) return null;
  const n = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Collecte récursive des codes CPV, quel que soit le niveau où ils vivent. */
export function collectCpv(node: Json, out: Set<string>): void {
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


export function decisionFromEforms(donnees: Json): TenderDecisionInfo {
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

  // Pondération des critères : c'est le deuxième signal de décision de la
  // spec, et il vit sous `cac:AwardingCriterion`, au niveau du lot le plus
  // souvent. Le poids est dans une extension eForms, pas dans le critère.
  const criteres: Array<{ libelle: string; poids: number | null }> = [];
  const seen = new Set<string>();
  for (const criterion of deepFind(notice, "cac:AwardingCriterion")) {
    for (const sub of asArray(dig(criterion, "cac:SubordinateAwardingCriterion"))) {
      const libelle = textOf(dig(sub, "cbc:Description"));
      if (!libelle) continue;
      const poids = numberOf(deepFind(sub, "efbc:ParameterNumeric")[0]);
      const key = `${libelle}|${poids}`;
      if (seen.has(key)) continue;
      seen.add(key);
      criteres.push({ libelle, poids });
    }
  }

  // Durée : `cbc:DurationMeasure` porte l'unité en attribut XML.
  let dureeMois: number | null = null;
  for (const measure of deepFind(notice, "cbc:DurationMeasure")) {
    const value = numberOf(measure);
    if (value === null) continue;
    const unit = String(dig(measure, "@unitCode") ?? "MONTH").toUpperCase();
    const months =
      unit === "YEAR" ? value * 12 : unit === "DAY" || unit === "DAYS" ? value / 30 : value;
    dureeMois = Math.round(months);
    break;
  }

  // Reconduction : la présence d'un bloc `cac:ContractExtension` suffit, avec
  // ou sans nombre maximal de reconductions.
  const extensions = deepFind(notice, "cac:ContractExtension");
  const reconductible = extensions.length > 0 ? true : null;

  return {
    titulaire: null,
    montant,
    duree_mois: dureeMois,
    reconductible,
    criteres,
    lots,
    url_dce: urlDce,
    contact_email: contact,
    ville: textOf(
      dig(notice, "cac:ContractingParty", "cac:Party", "cac:PostalAddress", "cbc:CityName"),
    ),
  };
}
