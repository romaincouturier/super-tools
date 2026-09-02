/**
 * Moyenne de l'appréciation générale par formation du catalogue et par année.
 *
 * Sert l'indicateur 2 du référentiel qualité, qui demande depuis le décret
 * 2026-728 de diffuser les indicateurs de résultats « en précisant de manière
 * transparente leurs modalités de calcul ». La règle appliquée ici est donc
 * volontairement explicite et tient en trois points :
 *   - l'année retenue est celle de la session, pas celle de la réponse ;
 *   - seules les évaluations réellement soumises et notées sont comptées ;
 *   - aucune pondération, c'est une moyenne arithmétique des notes sur 5.
 */

export interface SatisfactionTrainingInput {
  id: string;
  catalog_id: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface SatisfactionEvaluationInput {
  training_id: string | null;
  appreciation_generale: number | null;
  etat: string;
}

export interface SatisfactionStat {
  /** Moyenne sur 5, arrondie au dixième. */
  average: number;
  /** Nombre d'évaluations ayant servi au calcul. */
  count: number;
}

/** Statistiques d'une formation : par année, plus le cumul toutes années. */
export interface CatalogSatisfaction {
  byYear: Record<string, SatisfactionStat>;
  overall: SatisfactionStat;
}

/** Seul état d'évaluation qui compte : la réponse a été soumise par le participant. */
const SUBMITTED_STATE = "soumis";

/** Année de rattachement d'une session : sa fin, ou son début si elle n'a pas de fin. */
export function sessionYear(training: SatisfactionTrainingInput): string | null {
  const reference = training.end_date || training.start_date;
  if (!reference) return null;
  const year = reference.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function toStat(sum: number, count: number): SatisfactionStat {
  return { average: Math.round((sum / count) * 10) / 10, count };
}

export function computeCatalogSatisfaction(
  trainings: SatisfactionTrainingInput[],
  evaluations: SatisfactionEvaluationInput[],
): Record<string, CatalogSatisfaction> {
  const trainingIndex = new Map<string, { catalogId: string; year: string }>();
  for (const training of trainings) {
    const year = sessionYear(training);
    if (!training.catalog_id || !year) continue;
    trainingIndex.set(training.id, { catalogId: training.catalog_id, year });
  }

  // Sommes intermédiaires : la moyenne n'est calculée qu'une fois tout cumulé,
  // sinon on moyennerait des moyennes.
  const sums = new Map<string, { sum: number; count: number }>();
  const bump = (key: string, note: number) => {
    const current = sums.get(key) || { sum: 0, count: 0 };
    sums.set(key, { sum: current.sum + note, count: current.count + 1 });
  };

  for (const evaluation of evaluations) {
    if (evaluation.etat !== SUBMITTED_STATE) continue;
    if (evaluation.appreciation_generale == null) continue;
    if (!evaluation.training_id) continue;
    const target = trainingIndex.get(evaluation.training_id);
    if (!target) continue;

    bump(`${target.catalogId}::${target.year}`, evaluation.appreciation_generale);
    bump(`${target.catalogId}::*`, evaluation.appreciation_generale);
  }

  const result: Record<string, CatalogSatisfaction> = {};
  for (const [key, { sum, count }] of sums) {
    const [catalogId, year] = key.split("::");
    if (!result[catalogId]) {
      result[catalogId] = { byYear: {}, overall: { average: 0, count: 0 } };
    }
    if (year === "*") result[catalogId].overall = toStat(sum, count);
    else result[catalogId].byYear[year] = toStat(sum, count);
  }

  return result;
}

/** Années présentes dans les sessions, les plus récentes d'abord. */
export function availableYears(trainings: SatisfactionTrainingInput[]): string[] {
  const years = new Set<string>();
  for (const training of trainings) {
    const year = sessionYear(training);
    if (year) years.add(year);
  }
  return [...years].sort().reverse();
}

/** Statistique à afficher pour une formation, selon l'année sélectionnée. */
export function statForYear(
  satisfaction: CatalogSatisfaction | undefined,
  year: string | "all",
): SatisfactionStat | null {
  if (!satisfaction) return null;
  const stat = year === "all" ? satisfaction.overall : satisfaction.byYear[year];
  return stat && stat.count > 0 ? stat : null;
}
