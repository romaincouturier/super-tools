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
  for (const lot of lots.flat ? lots : lots) {
    for (const name of texts(lot, "Name")) {
      if (name.length < 5 || name.length > 300 || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  return out.slice(0, 12);
}

export function extractTenderDetail(raw: unknown): TenderDetail {
  if (!raw || typeof raw !== "object") {
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
  const rec = raw as Record<string, Json>;

  const descriptions = texts(raw, "Description")
    .filter((t) => t.length > 40)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  return {
    descriptions,
    lots: lotNames(raw),
    descripteurs: asText(rec.descripteur_libelle),
    villes: texts(raw, "CityName").slice(0, 4),
    emails: texts(raw, "ElectronicMail").slice(0, 3),
    telephones: texts(raw, "Telephone").slice(0, 2),
    procedure: asText(rec.procedure_libelle)[0] ?? null,
    typeMarche: asText(rec.type_marche)[0] ?? null,
  };
}
