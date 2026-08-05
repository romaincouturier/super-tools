/**
 * Lecture du flux TED (Tenders Electronic Daily), le journal officiel des
 * marchés publics européens.
 *
 * POURQUOI EN PLUS DU BOAMP. Tout marché français au-dessus du seuil européen
 * est publié aux deux endroits : sur la France, le TED ne fait que doublonner.
 * Ce qu'il apporte réellement, ce sont les autres pays et les institutions
 * européennes. Le filtre par pays est donc le réglage central de ce connecteur,
 * et il exclut la France par défaut — les avis français arrivent déjà par le
 * BOAMP, avec un parseur éprouvé sur des données réelles.
 *
 * CE QUI EST VÉRIFIÉ, CE QUI NE L'EST PAS. Le format des avis est eForms, le
 * même que celui du BOAMP depuis 2024 : le parseur de `_shared/eforms.ts` est
 * donc déjà éprouvé sur des avis réels. En revanche le CONTRAT DE TRANSPORT de
 * l'API — chemin, forme de la requête, noms des champs de réponse — n'a pas pu
 * être vérifié depuis l'environnement de développement, dont la sortie réseau
 * ne porte pas jusqu'à `api.ted.europa.eu`.
 *
 * D'où deux partis pris :
 *   1. La requête est construite en UN SEUL endroit (`buildTedSearchBody`),
 *      pour qu'une correction tienne en trois lignes.
 *   2. La lecture d'un avis ne code aucun chemin en dur : elle cherche les
 *      valeurs par NOM DE CLÉ, en profondeur, en essayant plusieurs noms
 *      candidats. C'est ce que fait déjà `src/lib/tenderDetail.ts` sur le
 *      BOAMP, précisément parce que les deux schémas nomment différemment les
 *      mêmes choses.
 *
 * Le mode sonde de `ted-sync` renvoie la requête envoyée, la réponse brute et
 * le résultat du mapping côte à côte : une seule exécution suffit à confirmer
 * ou corriger le contrat.
 */

import {
  collectCpv,
  deepFind,
  decisionFromEforms,
  textOf,
  type Json,
  type TenderDecisionInfo,
} from "./eforms.ts";
import type { NormalizedTender } from "./boamp.ts";

export type { NormalizedTender };

export const TED_BASE = "https://api.ted.europa.eu/v3";

/**
 * Taille de page. Le maximum documenté est 250 avis par page, avec un second
 * plafond : avis × champs demandés ne doit pas dépasser 10 000 par page. Avec
 * les 9 champs ci-dessous, 250 × 9 = 2 250, on est loin du plafond.
 */
export const TED_PAGE_SIZE = 250;
/** Plafond documenté : nombre d'avis × nombre de champs, par page. */
export const TED_MAX_FIELDS_PER_PAGE = 10_000;

/** Champs demandés pour chaque avis. */
export const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "buyer-name",
  "buyer-country",
  "classification-cpv",
  "publication-date",
  "deadline-receipt-request",
  "notice-type",
  "links",
];

/**
 * Première valeur textuelle trouvée sous l'un des noms donnés, à n'importe
 * quelle profondeur. Les avis TED portent le même champ sous plusieurs noms
 * selon la version du schéma et selon que la réponse est aplatie ou non.
 */
/**
 * Texte d'une valeur TED, y compris multilingue.
 *
 * Le TED rend ses libellés en `{ "fra": "...", "eng": "..." }` : `textOf` seul
 * y voit un objet et rend null. Sans ce traitement, le titre d'un avis était
 * absent du texte cherché par les mots-clés — la même panne silencieuse que la
 * recherche limitée au titre sur le BOAMP, et elle rendait le filtre aveugle.
 */
function localizedText(value: Json): string | null {
  const direct = textOf(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = localizedText(item);
      if (text) return text;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, Json>;
    // Français d'abord, anglais ensuite, puis la première langue venue.
    const preferred = textOf(rec.fra) ?? textOf(rec.fre) ?? textOf(rec.eng);
    if (preferred) return preferred;
    for (const key of Object.keys(rec)) {
      if (key.startsWith("@") || key === "#text") continue;
      const text = textOf(rec[key]);
      if (text) return text;
    }
  }
  return null;
}

export function firstText(node: Json, names: string[]): string | null {
  for (const name of names) {
    for (const found of deepFind(node, name)) {
      const value = localizedText(found);
      if (value) return value;
    }
  }
  return null;
}

/** Toutes les valeurs textuelles sous les noms donnés, dédoublonnées. */
export function allTexts(node: Json, names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    for (const found of deepFind(node, name)) {
      for (const value of Array.isArray(found) ? found : [found]) {
        const text = localizedText(value);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        out.push(text);
      }
    }
  }
  return out;
}

/**
 * Prose de l'avis, sur laquelle portent les mots-clés.
 *
 * Même périmètre que sur le BOAMP : titre, objet, description, intitulés de
 * lots et de critères. Volontairement pas le JSON entier, qui contient les
 * clauses de recours et les adresses, où n'importe quel mot finit par
 * apparaître.
 */
export function tedFullText(notice: Json, decision: TenderDecisionInfo): string {
  const parts = [
    ...allTexts(notice, [
      "notice-title",
      "title",
      "cbc:Name",
      "description-lot",
      "description-proc",
      "cbc:Description",
    ]),
    ...decision.lots,
    ...decision.criteres.map((c) => c.libelle),
  ];
  return parts.join(" ");
}

/**
 * Corps de la requête de recherche.
 *
 * `query` est en syntaxe « expert search » du TED. Les mots-clés sont cherchés
 * en plein texte, comme sur le BOAMP : la leçon du calibrage d'août 2026 est
 * qu'une recherche limitée au titre ne ramène presque rien — l'accord-cadre
 * dont le lot 4 s'appelait « Intelligence collective et facilitation » était
 * invisible.
 *
 * Le filtre par date est volontairement large : c'est le filtre local
 * (`matchTender`) qui tranche, l'API ne sert qu'à réduire le volume transporté.
 */
export function buildTedSearchBody(opts: {
  countries: string[];
  cpvCodes: string[];
  keywords: string[];
  since: string;
  /** Jeton rendu par l'appel précédent. Absent pour la première page. */
  iterationNextToken?: string | null;
}): Record<string, unknown> {
  const clauses: string[] = [];

  if (opts.countries.length) {
    clauses.push(`(${opts.countries.map((c) => `buyer-country=${c}`).join(" OR ")})`);
  }

  const subject: string[] = [
    ...opts.cpvCodes.map((code) => `classification-cpv=${code}`),
    ...opts.keywords.map((word) => `FT~"${word.replace(/"/g, "")}"`),
  ];
  if (subject.length) clauses.push(`(${subject.join(" OR ")})`);

  // Format attendu par le TED : AAAAMMJJ, sans séparateur.
  const day = opts.since.slice(0, 10).replace(/-/g, "");
  if (/^\d{8}$/.test(day)) clauses.push(`publication-date>=${day}`);

  // Mode itération plutôt que pagination : la documentation le donne comme le
  // mode des réutilisateurs de données. Il gèle l'index le temps du parcours,
  // donc aucun avis manqué ni compté deux fois si le TED publie pendant la
  // synchronisation, et il n'a pas le plafond de 15 000 avis du mode paginé.
  const body: Record<string, unknown> = {
    query: clauses.join(" AND "),
    limit: Math.min(TED_PAGE_SIZE, Math.floor(TED_MAX_FIELDS_PER_PAGE / TED_FIELDS.length)),
    fields: TED_FIELDS,
    paginationMode: "ITERATION",
  };
  // Absent au premier appel : c'est ce qui distingue la première page.
  if (opts.iterationNextToken) body.iterationNextToken = opts.iterationNextToken;
  return body;
}

/** URL publique d'un avis TED à partir de son numéro de publication. */
export function tedNoticeUrl(publicationNumber: string): string | null {
  const clean = publicationNumber.trim();
  if (!clean) return null;
  return `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(clean)}`;
}

/**
 * Normalise un avis TED vers la même forme qu'un avis BOAMP.
 *
 * Rien n'est cherché par chemin fixe : l'API peut aplatir ou non la réponse,
 * et les noms de champs changent d'une version de schéma à l'autre. Un champ
 * introuvable donne null, jamais une exception — c'est `parse_error` qui
 * portera l'anomalie, pour qu'elle se compte au lieu de disparaître.
 */
export function mapTedNotice(notice: Json): NormalizedTender {
  let parseError: string | null = null;
  let decision: TenderDecisionInfo;

  try {
    decision = decisionFromEforms(notice);
  } catch (e) {
    parseError = e instanceof Error ? e.message : "lecture eForms impossible";
    decision = {
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
  }

  const sourceRef =
    firstText(notice, ["publication-number", "ND", "publicationNumber", "cbc:ID"]) ?? "";

  const cpv = new Set<string>();
  collectCpv(notice, cpv);
  // La recherche TED rend aussi les CPV comme une liste à plat, que
  // `collectCpv` ne reconnaît pas : elle n'attend que les clés du schéma XML.
  for (const code of allTexts(notice, ["classification-cpv", "cpv"])) {
    if (/^\d{8}$/.test(code)) cpv.add(code);
  }

  const country = firstText(notice, ["buyer-country", "country", "cbc:IdentificationCode"]);

  return {
    source: "ted",
    source_ref: sourceRef,
    url_avis:
      firstText(notice, ["links", "url", "notice-url"]) ??
      (sourceRef ? tedNoticeUrl(sourceRef) : null),
    objet: firstText(notice, ["notice-title", "title", "cbc:Name"]),
    acheteur: firstText(notice, ["buyer-name", "official-name", "cbc:RegistrationName"]),
    nature: firstText(notice, ["notice-type", "form-type"]),
    type_marche: firstText(notice, ["contract-nature", "cbc:ProcurementTypeCode"]),
    famille_libelle: null,
    // Le pays tient lieu de département : c'est le repère géographique utile
    // hors de France, et la fiche l'affiche au même endroit.
    code_departement: country ? [country] : [],
    cpv_codes: [...cpv],
    dateparution: firstText(notice, ["publication-date", "dispatch-date"]),
    datelimitereponse: firstText(notice, [
      "deadline-receipt-request",
      "deadline-receipt-tender",
      "cbc:EndDate",
    ]),
    decision,
    full_text: tedFullText(notice, decision),
    raw: notice,
    parse_error: parseError,
  };
}
