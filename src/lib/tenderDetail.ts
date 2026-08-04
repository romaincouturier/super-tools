/**
 * Lecture du contenu détaillé d'un avis, à partir du JSON brut du BOAMP.
 *
 * La fiche de décision ne montre que des signaux courts ; quand un avis mérite
 * un examen, il faut le texte réel : objet complet, description, lots, lieu
 * d'exécution, contact acheteur. Ces éléments sont dans `raw`, sous deux
 * schémas différents (eForms UBL depuis 2024, ancien format avant), donc on ne
 * code aucun chemin en dur : on cherche les clés par leur nom, en profondeur.
 */

type Json = unknown;

/**
 * Le BOAMP livre `donnees` (tout le contenu réel de l'avis) sous forme de
 * CHAÎNE JSON, pas d'objet. Sans ce décodage, toute recherche en profondeur
 * s'arrête à la surface de l'enregistrement et la fiche paraît vide.
 */
function decodeNestedJson(node: Json, depth = 0): Json {
  if (depth > 6) return node;
  if (typeof node === "string") {
    const s = node.trim();
    if (s.length > 1 && (s[0] === "{" || s[0] === "[")) {
      try {
        return decodeNestedJson(JSON.parse(s), depth + 1);
      } catch {
        return node;
      }
    }
    return node;
  }
  if (Array.isArray(node)) return node.map((n) => decodeNestedJson(n, depth + 1));
  if (node && typeof node === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(node as Record<string, Json>)) {
      out[k] = decodeNestedJson(v, depth + 1);
    }
    return out;
  }
  return node;
}

/** Toutes les valeurs rencontrées sous une clé donnée, quelle que soit la profondeur. */
function collect(node: Json, keyMatcher: (key: string) => boolean, out: Json[] = []): Json[] {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, keyMatcher, out);
    return out;
  }
  for (const [key, value] of Object.entries(node as Record<string, Json>)) {
    if (keyMatcher(key)) out.push(value);
    collect(value, keyMatcher, out);
  }
  return out;
}


/** Texte d'un noeud eForms : chaîne nue, ou `{ "#text": ... }`, ou tableau des deux. */
function asText(node: Json): string[] {
  if (node == null) return [];
  if (typeof node === "string") return [node.trim()].filter(Boolean);
  if (typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(asText);
  if (typeof node === "object") {
    const rec = node as Record<string, Json>;
    if ("#text" in rec) return asText(rec["#text"]);
    return [];
  }
  return [];
}

function texts(raw: Json, localName: string): string[] {
  const suffix = localName.toLowerCase();
  const values = collect(raw, (k) => k.toLowerCase().split(":").pop() === suffix);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of values.flatMap(asText)) {
    const clean = t.replace(/\s+/g, " ").trim();
    if (clean.length < 2 || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

export interface TenderDetail {
  /** Descriptions longues trouvées dans l'avis, la plus longue en premier. */
  descriptions: string[];
  /** Intitulés des lots (`cbc:Name` des ProcurementProjectLot en eForms). */
  lots: string[];
  /** Thématiques BOAMP (`descripteur_libelle`) : le tri le plus lisible. */
  descripteurs: string[];
  /** Villes citées comme lieu d'exécution ou adresse acheteur. */
  villes: string[];
  emails: string[];
  telephones: string[];
  /** Procédure et type de marché, tels que libellés par le BOAMP. */
  procedure: string | null;
  typeMarche: string | null;
}

/**
 * Intitulés des lots. On descend d'abord sur les noeuds de lot pour ne pas
 * ramasser les noms d'organisations, qui portent la même clé `cbc:Name`.
 */
function lotNames(raw: Json): string[] {
  const lots = collect(raw, (k) => k.toLowerCase().split(":").pop() === "procurementprojectlot");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const lot of lots) {
    for (const name of texts(lot, "Name")) {
      if (name.length < 5 || name.length > 300 || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out.slice(0, 12);
}

/** Plusieurs noms de clé pour une même information, selon le schéma. */
function firstTexts(raw: Json, names: string[], min = 2): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    for (const t of texts(raw, name)) {
      if (t.length < min || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export function extractTenderDetail(rawInput: unknown): TenderDetail {
  if (!rawInput || typeof rawInput !== "object") {
    return {
      descriptions: [],
      lots: [],
      descripteurs: [],
      villes: [],
      emails: [],
      telephones: [],
      procedure: null,
      typeMarche: null,
    };
  }
  const raw = decodeNestedJson(rawInput);
  const rec = raw as Record<string, Json>;

  // eForms : `cbc:Description`. Ancien schéma MAPA/AVIS : `objet`,
  // `OBJET_COMPLET`, plus les conditions et renseignements complémentaires.
  const descriptions = firstTexts(raw, [
    "Description",
    "OBJET_COMPLET",
    "objet",
    "TITRE_MARCHE",
    "conditions",
    "renseignements",
    "infosSup",
  ])
    .filter((t) => t.length > 40)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  return {
    descriptions,
    lots: lotNames(raw),
    descripteurs: asText(rec.descripteur_libelle),
    villes: firstTexts(raw, ["CityName", "ville", "VILLE"]).slice(0, 4),
    emails: firstTexts(raw, ["ElectronicMail", "mel", "MEL"], 5)
      .filter((t) => t.includes("@"))
      .slice(0, 3),
    telephones: firstTexts(raw, ["Telephone", "tel", "TEL"], 6).slice(0, 2),
    procedure: asText(rec.procedure_libelle)[0] ?? null,

    typeMarche: asText(rec.type_marche)[0] ?? null,
  };
}
