// Estimation du montant d'une opportunité CRM entrante.
// Formations : prix catalogue SuperTools par personne (inter) ; intra sans
// effectif connu : médiane des intra gagnés. Missions : médiane des gagnées.

export type OpportunityFormat = "inter" | "intra" | "elearning";

export interface CatalogFormation {
  name: string;
  price: number | null;
  formulas: { name: string; price: number | null }[];
}

export interface WonOpportunity {
  estimated_value: number | null;
  service_type: string | null;
  company: string | null;
  title: string | null;
}

export interface OpportunitySignals {
  service_type: "formation" | "mission" | null;
  company: string | null;
  title?: string | null;
  formation_name?: string | null;
  format?: OpportunityFormat | null;
  participants?: number | null;
}

export interface ValueEstimate {
  value: number;
  basis: string;
  count: number;
  formation?: string;
}

/** Un groupe intra compte au moins ce nombre de places catalogue. */
export const INTRA_MIN_SEATS = 3;

export function normalizeLabel(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^formation\s+(en\s+ligne\s+)?(a\s+la\s+|en\s+)?/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set(["de", "la", "le", "les", "des", "du", "et", "en", "a", "avec", "sa", "ses", "son", "un", "une", "pour", "sur", "l", "d"]);
function tokens(v: string): string[] {
  return normalizeLabel(v).split(" ").filter((t) => t.length > 1 && !STOP.has(t));
}

/** Formation du catalogue correspondant au nom donné (exact puis mots communs). */
export function matchCatalogFormation(
  name: string | null | undefined,
  catalog: CatalogFormation[],
): CatalogFormation | null {
  const n = normalizeLabel(name);
  if (!n) return null;
  const exact = catalog.find((c) => normalizeLabel(c.name) === n);
  if (exact) return exact;
  const wanted = tokens(n);
  if (wanted.length === 0) return null;
  let best: CatalogFormation | null = null;
  let bestScore = 0;
  for (const c of catalog) {
    const have = new Set(tokens(c.name));
    if (have.size === 0) continue;
    const common = wanted.filter((t) => have.has(t)).length;
    const score = common / Math.max(wanted.length, have.size);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.6 ? best : null;
}

/** Prix par personne : formule « Entreprises », sinon prix fiche, sinon formule la plus chère ; e-learning : formule la moins chère. */
export function unitPrice(formation: CatalogFormation, format: OpportunityFormat | null | undefined): number | null {
  const formulas = formation.formulas.filter((f) => (f.price ?? 0) > 0);
  if (format === "elearning" && formulas.length > 0) {
    return Math.min(...formulas.map((f) => f.price as number));
  }
  const company = formulas.find((f) => {
    const l = normalizeLabel(f.name);
    return /^entreprises?$/.test(l);
  });
  if (company) return company.price as number;
  if ((formation.price ?? 0) > 0) return formation.price as number;
  if (formulas.length > 0) return Math.max(...formulas.map((f) => f.price as number));
  return null;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round = (v: number, step: number) => Math.max(0, Math.round(v / step) * step);
const sameCompany = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function medianEstimate(rows: WonOpportunity[], basis: string): ValueEstimate | null {
  const values = rows.map((r) => Number(r.estimated_value) || 0).filter((v) => v > 0);
  if (values.length === 0) return null;
  return { value: round(median(values), 100), basis, count: values.length };
}

export function estimateOpportunityValue(
  signals: OpportunitySignals,
  catalog: CatalogFormation[],
  won: WonOpportunity[],
): ValueEstimate {
  const valued = won.filter((w) => (Number(w.estimated_value) || 0) > 0);
  const ofType = (t: string) => valued.filter((w) => w.service_type === t);
  const participants = signals.participants && signals.participants > 0 ? Math.round(signals.participants) : null;

  if (signals.service_type === "mission") {
    const missions = ofType("mission");
    return medianEstimate(missions.filter((w) => sameCompany(w.company, signals.company)), "médiane des missions gagnées pour ce client")
      ?? medianEstimate(missions, "médiane des missions gagnées")
      ?? { value: 0, basis: "aucune mission gagnée", count: 0 };
  }

  if (signals.service_type === "formation") {
    const formations = ofType("formation");
    const formation = matchCatalogFormation(signals.formation_name, catalog)
      ?? matchCatalogFormation(signals.title, catalog);
    const price = formation ? unitPrice(formation, signals.format) : null;

    if (formation && price) {
      if (signals.format === "intra" && !participants) {
        const sameFormation = formations.filter((w) => matchCatalogFormation(w.title, [formation]));
        const intra = (rows: WonOpportunity[]) => rows.filter((w) => Number(w.estimated_value) >= price * INTRA_MIN_SEATS);
        const est = medianEstimate(intra(sameFormation), `médiane des intra gagnés « ${formation.name} »`)
          ?? medianEstimate(intra(formations), "médiane des formations intra gagnées");
        if (est) return { ...est, formation: formation.name };
        return { value: round(price * INTRA_MIN_SEATS, 10), basis: `catalogue ${price} € × ${INTRA_MIN_SEATS} personnes`, count: 0, formation: formation.name };
      }
      const seats = participants ?? 1;
      return {
        value: round(price * seats, 10),
        basis: `catalogue ${price} € × ${seats} personne${seats > 1 ? "s" : ""}`,
        count: 0,
        formation: formation.name,
      };
    }

    return medianEstimate(formations.filter((w) => sameCompany(w.company, signals.company)), "médiane des formations gagnées pour ce client")
      ?? medianEstimate(formations, "médiane des formations gagnées (hors catalogue)")
      ?? { value: 0, basis: "aucune formation gagnée", count: 0 };
  }

  return medianEstimate(valued, "médiane des opportunités gagnées") ?? { value: 0, basis: "aucun historique", count: 0 };
}

/** Champs supplémentaires demandés à l'IA pour estimer le montant. */
export function valueSignalsPrompt(catalogNames: string[]): string {
  const list = catalogNames.length ? catalogNames.map((n) => `- "${n}"`).join("\n") : "(catalogue vide)";
  return `- formation_name: si formation, nom EXACT de la formation du catalogue ci-dessous qui correspond, sinon null
- format: "inter" (inscription individuelle à une session ouverte), "intra" (groupe dédié pour une organisation), "elearning" (formation en ligne) ou null
- participants: nombre de personnes à former si indiqué, sinon null

Catalogue des formations :
${list}`;
}

export function parseValueSignals(raw: Record<string, unknown>): Pick<OpportunitySignals, "formation_name" | "format" | "participants"> {
  const format = raw.format === "inter" || raw.format === "intra" || raw.format === "elearning" ? raw.format : null;
  const p = Number(raw.participants);
  return {
    formation_name: typeof raw.formation_name === "string" && raw.formation_name.trim() ? raw.formation_name.trim() : null,
    format,
    participants: Number.isFinite(p) && p > 0 && p < 1000 ? Math.round(p) : null,
  };
}
