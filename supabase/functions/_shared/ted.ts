/**
 * Lecture du flux TED (Tenders Electronic Daily), le journal officiel des
 * marchés publics européens.
 *
 * POURQUOI EN PLUS DU BOAMP. Le TED couvre toute l'Europe, là où le BOAMP
 * s'arrête à la France. Un marché français au-dessus du seuil européen est
 * publié aux deux endroits, mais c'est le rapprochement inter-sources qui s'en
 * occupe, pas une exclusion de pays.
 *
 * NI LA GÉOGRAPHIE NI LA LANGUE NE FILTRENT. Aucun pays n'est exclu par défaut.
 * La langue non plus : mesure faite le 05/08/2026 sur les avis réels, le TED
 * traduit chaque avis dans les 24 langues officielles, donc « existe en
 * français ou anglais » est vrai pour 100 % des avis. Un filtre de langue y est
 * inerte, et le repointer sur la langue d'origine écarterait un avis polonais
 * qu'on lit très bien dans la traduction anglaise que le TED fournit. Le seul
 * tri qui a du sens est le SUJET, par mots-clés.
 *
 * ET LE SUJET, C'EST LES MOTS-CLÉS, PAS LES CPV LARGES. Les codes CPV de
 * formation partagés avec le BOAMP tiennent à l'échelle de la France mais
 * inondent à l'échelle de l'Europe (262 avis retenus sur deux mois contre 6
 * pour les mots-clés). Le TED a donc sa propre liste CPV, vide par défaut : il
 * se repère sur les mots-clés métier, en français et en anglais.
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

/**
 * Champs demandés pour chaque avis.
 *
 * La première version n'en demandait que neuf : la fiche d'un avis TED était
 * donc vide là où celle d'un avis BOAMP montrait la description, le montant,
 * les critères et le lien du DCE. Le TED ne renvoie QUE les champs demandés,
 * il n'y a pas de « tout l'avis » implicite : ce qui n'est pas listé ici est
 * définitivement absent du `raw` stocké, et aucune lecture côté fiche ne peut
 * le rattraper.
 *
 * Plafond documenté : avis × champs ≤ 10 000 par page. `buildTedSearchBody`
 * calcule la taille de page à partir de cette liste, donc l'allonger réduit
 * la page au lieu de casser la requête.
 */
export const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "notice-type",
  "procedure-type",
  "contract-nature",
  "official-language",
  // Contenu réel de l'avis : c'est ce qui manquait le plus.
  "description-proc",
  "description-lot",
  "title-lot",
  // Acheteur et contact.
  "buyer-name",
  "buyer-country",
  "buyer-city",
  "buyer-email",
  "buyer-internet-address",
  "main-activity",
  // Objet et calendrier.
  "classification-cpv",
  "publication-date",
  "deadline-receipt-request",
  // Montant, durée, accord-cadre.
  "estimated-value-proc",
  "estimated-value-cur-proc",
  "estimated-value-lot",
  "estimated-value-cur-lot",
  "framework-agreement-lot",
  "duration-period-value-lot",
  "duration-period-unit-lot",
  // Lieu d'exécution.
  "place-of-performance-city-lot",
  "place-of-performance-country-lot",
  // Critères d'attribution.
  "award-criterion-name-lot",
  "award-criterion-type-lot",
  // Retrait du dossier et dépôt de l'offre.
  "document-url-lot",
  "submission-url-lot",
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
    // Récursif : le TED rend souvent la valeur d'une langue comme un TABLEAU
    // (`{"eng": ["Fingal County Council"]}`), que `textOf` seul voit comme un
    // objet et rend null — c'est ce qui laissait `acheteur` vide.
    const preferred = localizedText(rec.fra) ?? localizedText(rec.fre) ?? localizedText(rec.eng);
    if (preferred) return preferred;
    for (const key of Object.keys(rec)) {
      if (key.startsWith("@") || key === "#text") continue;
      const text = localizedText(rec[key]);
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
      "title-lot",
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

  // Aucun pays par défaut : on prospecte sur la langue de l'avis, pas sur sa
  // géographie. La clause n'apparaît que si le réglage a été resserré.
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
 * Complète la fiche de décision avec les champs plats de la recherche TED.
 *
 * `decisionFromEforms` sait lire un avis eForms complet (le XML), pas la
 * réponse de recherche, qui est un objet plat aux clés en tirets. Sans cette
 * reprise, un avis TED n'affichait ni montant, ni durée, ni critères, ni lien
 * du DCE : tout était présent dans la réponse et perdu à la lecture.
 */
function enrichFromFlatFields(notice: Json, base: TenderDecisionInfo): TenderDecisionInfo {
  const num = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const devise = firstText(notice, ["estimated-value-cur-proc", "estimated-value-cur-lot"]);
  const montant =
    base.montant ??
    num(firstText(notice, ["estimated-value-proc", "estimated-value-lot"]));

  // Durée : la valeur et son unité sont dans deux champs distincts.
  const dureeValeur = num(firstText(notice, ["duration-period-value-lot"]));
  const dureeUnite = (firstText(notice, ["duration-period-unit-lot"]) ?? "").toUpperCase();
  const dureeMois =
    base.duree_mois ??
    (dureeValeur == null
      ? null
      : dureeUnite.startsWith("YEAR")
        ? dureeValeur * 12
        : dureeUnite.startsWith("WEEK")
          ? Math.round(dureeValeur / 4.345)
          : dureeUnite.startsWith("DAY")
            ? Math.round(dureeValeur / 30)
            : dureeValeur);

  // Le TED ne publie pas la pondération chiffrée dans la recherche : le champ
  // de poids ne contient qu'un code de type (`per-exa`). Afficher un intitulé
  // sans poids vaut mieux qu'une liste vide.
  const criteres = base.criteres.length
    ? base.criteres
    : allTexts(notice, ["award-criterion-name-lot"]).map((libelle) => ({ libelle, poids: null }));

  const lots = base.lots.length
    ? base.lots
    : allTexts(notice, ["title-lot", "description-lot"]).slice(0, 12);

  const lieu =
    base.ville ??
    firstText(notice, ["place-of-performance-city-lot", "buyer-city"]);

  const accordCadre = (firstText(notice, ["framework-agreement-lot"]) ?? "").toLowerCase();

  return {
    ...base,
    montant,
    duree_mois: dureeMois,
    reconductible:
      base.reconductible ?? (accordCadre && accordCadre !== "none" ? true : base.reconductible),
    criteres,
    lots,
    ville: lieu,
    url_dce: base.url_dce ?? firstText(notice, ["document-url-lot", "submission-url-lot"]),
    contact_email: base.contact_email ?? firstText(notice, ["buyer-email"]),
    // Champs propres au TED : la fiche les affiche, la devise en premier —
    // « 3 500 000 € » pour un marché en couronnes serait un contresens.
    devise: devise ?? null,
    procedure: firstText(notice, ["procedure-type"]),
    langue: firstText(notice, ["official-language"]),
    url_soumission: firstText(notice, ["submission-url-lot"]),
    site_acheteur: firstText(notice, ["buyer-internet-address"]),
  };
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
  decision = enrichFromFlatFields(notice, decision);


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
    // Le numéro de publication d'abord : `links` mène au XML ou au PDF d'une
    // langue, pas à la page lisible de l'avis.
    url_avis:
      (sourceRef ? tedNoticeUrl(sourceRef) : null) ??
      firstText(notice, ["url", "notice-url"]),
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


// ── Parcours des pages ───────────────────────────────────────

/** Une page telle que rendue par l'API, avant interprétation. */
export interface TedPage {
  status: number;
  payload: Json;
}

export interface TedWalkResult {
  notices: unknown[];
  pages: number;
  /** Vrai quand le parcours s'est arrêté avant d'avoir tout lu. */
  truncated: boolean;
  /**
   * Raison de l'arrêt anticipé, `null` si le parcours est allé au bout.
   * Une page en échec au milieu du parcours ne doit PAS passer pour une
   * synchronisation réussie : sans cette remontée, il manquerait des avis et
   * le compteur dirait quand même « succès ».
   */
  error: string | null;
}

/** Les avis d'une page, quelle que soit la clé d'enveloppe. */
export function noticesOf(payload: Json): unknown[] {
  const found = payload?.notices ?? payload?.results ?? payload?.content ?? payload;
  return Array.isArray(found) ? found : [];
}

/**
 * Suit `iterationNextToken` jusqu'à épuisement.
 *
 * Sans ce parcours, une seule page serait lue — 250 avis au plus — et le reste
 * manquerait sans que rien ne le signale. C'est le défaut le plus coûteux
 * possible sur un connecteur : invisible.
 *
 * Deux garde-fous, parce qu'un jeton qui ne s'épuise jamais boucle à l'infini :
 * un nombre maximum d'avis et un nombre maximum de pages. Atteindre l'un des
 * deux marque le résultat comme tronqué.
 */
export async function walkTedPages(opts: {
  fetchPage: (token: string | null) => Promise<TedPage>;
  maxRecords: number;
  maxPages: number;
  /**
   * Première page déjà récupérée par l'appelant. La sonde a besoin de la lire
   * avant de décider ; sans ce passage de relais, elle serait demandée deux
   * fois — un appel gaspillé, et surtout deux gels d'index différents en mode
   * itération, donc un jeton qui ne correspond plus au parcours en cours.
   */
  firstPage?: TedPage;
}): Promise<TedWalkResult> {
  const first = opts.firstPage ?? (await opts.fetchPage(null));
  if (first.status < 200 || first.status >= 300) {
    return { notices: [], pages: 0, truncated: false, error: `TED a répondu ${first.status}` };
  }

  const notices: unknown[] = [...noticesOf(first.payload)];
  let token: string | null = first.payload?.iterationNextToken ?? null;
  let pages = 1;

  while (token) {
    if (notices.length >= opts.maxRecords || pages >= opts.maxPages) {
      return { notices, pages, truncated: true, error: null };
    }
    const next = await opts.fetchPage(token);
    if (next.status < 200 || next.status >= 300) {
      return {
        notices,
        pages,
        truncated: true,
        error: `page ${pages + 1} : TED a répondu ${next.status}`,
      };
    }
    const batch = noticesOf(next.payload);
    // Page vide alors que le jeton existait encore : le TED considère le
    // parcours terminé, ce n'est pas une anomalie.
    if (!batch.length) break;
    notices.push(...batch);
    token = next.payload?.iterationNextToken ?? null;
    pages++;
  }

  return { notices, pages, truncated: false, error: null };
}
