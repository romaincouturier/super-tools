/**
 * Effectivité du suivi des modules réalisés à distance.
 *
 * Le décret 2026-728 ajoute à l'indicateur 19 : « Lorsque des modules
 * pédagogiques sont réalisés à distance, le prestataire vérifie l'effectivité
 * de leur suivi par les apprenants. »
 *
 * Deux principes guident le calcul :
 *
 *   - Le statut ne repose jamais sur le temps de connexion. Une session
 *     ouverte n'est pas un apprentissage : seules comptent les leçons
 *     terminées et les activités rendues.
 *   - Chaque statut est justifié par les faits qui le fondent, restitués dans
 *     `reasons`. Un auditeur doit pouvoir remonter du statut aux preuves.
 */

export interface LessonProgress {
  lesson_id: string | null;
  status: string;
  completed_at: string | null;
}

export interface LessonView {
  lesson_id: string | null;
}

export interface QuizAttempt {
  quiz_id: string | null;
  passed: boolean | null;
  completed_at: string | null;
}

export interface SubmittedWork {
  lesson_id: string | null;
  created_at: string;
}

export interface LearnerActivity {
  learnerEmail: string;
  progress: LessonProgress[];
  views: LessonView[];
  quizAttempts: QuizAttempt[];
  submittedWork: SubmittedWork[];
}

export type FollowUpStatus =
  | "non_commence"
  | "en_cours"
  | "suivi_conforme"
  | "a_relancer"
  | "incomplet";

export interface FollowUpResult {
  learnerEmail: string;
  /** Leçons obligatoires du parcours. */
  expected: number;
  /** Leçons ouvertes au moins une fois. */
  opened: number;
  /** Leçons marquées terminées. */
  completed: number;
  /** Quiz passés et travaux remis : l'activité pédagogique réelle. */
  activities: number;
  /** Date de la dernière trace d'activité, hors simple consultation. */
  lastActivityAt: string | null;
  status: FollowUpStatus;
  reasons: string[];
}

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  non_commence: "Non commencé",
  en_cours: "En cours",
  suivi_conforme: "Suivi conforme",
  a_relancer: "À relancer",
  incomplet: "Incomplet",
};

const COMPLETED = "completed";

function daysBetween(from: string, to: string): number {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/**
 * @param mandatoryLessonIds leçons obligatoires du parcours, qui définissent
 *   ce qui est attendu. Un parcours sans leçon obligatoire ne peut pas être
 *   déclaré conforme : il n'y a rien à vérifier.
 * @param inactivityDays délai sans activité pédagogique au-delà duquel une
 *   relance s'impose. Le décret n'en fixe aucun : c'est un choix de pilotage,
 *   passé par l'appelant plutôt que figé ici.
 */
export function computeFollowUp(
  activity: LearnerActivity,
  mandatoryLessonIds: string[],
  today: string,
  inactivityDays = 21,
): FollowUpResult {
  const mandatory = new Set(mandatoryLessonIds);

  const openedLessons = new Set(
    activity.views.map((v) => v.lesson_id).filter((id): id is string => !!id && mandatory.has(id)),
  );
  const completedLessons = new Set(
    activity.progress
      .filter((p) => p.status === COMPLETED && p.lesson_id && mandatory.has(p.lesson_id))
      .map((p) => p.lesson_id as string),
  );
  // Une leçon terminée a forcément été ouverte, même si la vue n'a pas été
  // tracée : sans ça, un parcours terminé pourrait afficher zéro ouverture.
  for (const id of completedLessons) openedLessons.add(id);

  const passedQuizzes = activity.quizAttempts.filter((q) => q.passed === true);
  const activities = passedQuizzes.length + activity.submittedWork.length;

  const activityDates = [
    ...activity.progress.filter((p) => p.status === COMPLETED).map((p) => p.completed_at),
    ...passedQuizzes.map((q) => q.completed_at),
    ...activity.submittedWork.map((w) => w.created_at),
  ].filter((d): d is string => !!d);

  const lastActivityAt = activityDates.length
    ? activityDates.reduce((latest, d) => (d > latest ? d : latest))
    : null;

  const expected = mandatory.size;
  const reasons: string[] = [];
  let status: FollowUpStatus;

  if (openedLessons.size === 0 && activities === 0) {
    status = "non_commence";
    reasons.push("Aucun module ouvert, aucune activité rendue.");
  } else if (expected > 0 && completedLessons.size >= expected) {
    if (activities === 0) {
      // Toutes les leçons cochées sans le moindre quiz ni travail rendu : le
      // parcours est marqué terminé mais rien ne prouve l'apprentissage.
      status = "incomplet";
      reasons.push(
        `${completedLessons.size} module${completedLessons.size > 1 ? "s" : ""} terminé${completedLessons.size > 1 ? "s" : ""}, mais aucune activité rendue.`,
      );
    } else {
      status = "suivi_conforme";
      reasons.push(`${completedLessons.size}/${expected} modules obligatoires terminés.`);
      reasons.push(`${activities} activité${activities > 1 ? "s" : ""} rendue${activities > 1 ? "s" : ""}.`);
    }
  } else if (lastActivityAt && daysBetween(lastActivityAt, today) > inactivityDays) {
    status = "a_relancer";
    reasons.push(
      `Aucune activité depuis ${daysBetween(lastActivityAt, today)} jours (seuil : ${inactivityDays}).`,
    );
    reasons.push(`${completedLessons.size}/${expected} modules obligatoires terminés.`);
  } else if (!lastActivityAt) {
    status = "a_relancer";
    reasons.push(
      `${openedLessons.size} module${openedLessons.size > 1 ? "s" : ""} ouvert${openedLessons.size > 1 ? "s" : ""}, aucune activité rendue à ce jour.`,
    );
  } else {
    status = "en_cours";
    reasons.push(`${completedLessons.size}/${expected} modules obligatoires terminés.`);
    if (activities > 0) {
      reasons.push(`${activities} activité${activities > 1 ? "s" : ""} rendue${activities > 1 ? "s" : ""}.`);
    }
  }

  return {
    learnerEmail: activity.learnerEmail,
    expected,
    opened: openedLessons.size,
    completed: completedLessons.size,
    activities,
    lastActivityAt,
    status,
    reasons,
  };
}

/** Répartition des apprenants par statut, pour le résumé de session. */
export function summarizeFollowUp(results: FollowUpResult[]): Record<FollowUpStatus, number> {
  const summary: Record<FollowUpStatus, number> = {
    non_commence: 0,
    en_cours: 0,
    suivi_conforme: 0,
    a_relancer: 0,
    incomplet: 0,
  };
  for (const result of results) summary[result.status] += 1;
  return summary;
}
