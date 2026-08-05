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
      } catch (_notJson) {
        // Sonde de type et non gestion d'erreur : une chaîne qui commence par
        // { ou [ sans être du JSON est simplement du texte. Rien à reporter,
        // d'où la liaison explicitement ignorée plutôt qu'un catch nu.
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
    // Le TED rend ses libellés indexés par langue : `{ "fra": ["..."] }`.
    // Sans ce cas, la description, l'acheteur et les lots d'un avis européen
    // sont invisibles alors qu'ils sont bien dans l'avis stocké.
    const langKeys = Object.keys(rec).filter((k) => /^[a-z]{3}$/.test(k));
    if (langKeys.length) {
      const pick = ["fra", "fre", "eng", "mul"].find((k) => langKeys.includes(k)) ?? langKeys[0];
      return asText(rec[pick]);
    }
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

  // L'objet réel du marché d'abord : il vit sous `ProcurementProject` en
  // eForms, sous `description.objet` dans l'ancien schéma. Le reste (recours,
  // conditions financières) ne doit pas passer devant sous prétexte d'être
  // plus long.
  const projectNodes = collect(
    raw,
    (k) => k.toLowerCase().split(":").pop() === "procurementproject",
  );
  const primary = [
    ...projectNodes.flatMap((n) => firstTexts(n, ["Description", "Name"])),
    ...firstTexts(raw, ["OBJET_COMPLET", "objet", "TITRE_MARCHE"]),
    // Clés plates de la recherche TED : c'est là que vit la description d'un
    // avis européen, il n'y a pas de noeud `ProcurementProject`.
    ...firstTexts(raw, ["description-proc", "description-lot"]),
  ].filter((t) => t.length > 40);

  const others = firstTexts(raw, ["Description", "conditions", "renseignements", "infosSup"])
    .filter((t) => t.length > 40 && !primary.includes(t))
    .sort((a, b) => b.length - a.length);

  const descriptions = [...new Set([...primary, ...others])].slice(0, 5);

  const lots = lotNames(raw);

  return {
    descriptions,
    lots: lots.length ? lots : firstTexts(raw, ["title-lot"], 5).slice(0, 12),
    descripteurs: asText(rec.descripteur_libelle),
    villes: firstTexts(raw, [
      "CityName",
      "ville",
      "VILLE",
      "place-of-performance-city-lot",
      "buyer-city",
    ]).slice(0, 4),
    emails: firstTexts(raw, ["ElectronicMail", "mel", "MEL", "buyer-email"], 5)
      .filter((t) => t.includes("@"))
      .slice(0, 3),
    telephones: firstTexts(raw, ["Telephone", "tel", "TEL"], 6).slice(0, 2),
    procedure:
      asText(rec.procedure_libelle)[0] ?? firstTexts(raw, ["procedure-type"], 3)[0] ?? null,

    typeMarche: asText(rec.type_marche)[0] ?? asText(rec["contract-nature"])[0] ?? null,
  };
}

