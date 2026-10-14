/**
 * Formations gratuites retirées des vitrines publiques (page d'accueil et
 * écran de création de compte). Une seule liste : une formation cachée d'un
 * côté ne doit pas réapparaître de l'autre.
 */
export const HIDDEN_FREE_COURSE_IDS = new Set(["826c2e2c-884d-461d-be61-3bd66ae34440"]);

/**
 * Ordre de la section « Commencez gratuitement » : landing_position croissant,
 * puis created_at pour les cours sans position (placés en fin de liste).
 */
export function sortFreeCourses<T extends { landing_position: number | null; created_at: string }>(courses: T[]): T[] {
  return courses.slice().sort((a, b) => {
    const pa = a.landing_position ?? Number.POSITIVE_INFINITY;
    const pb = b.landing_position ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return a.created_at.localeCompare(b.created_at);
  });
}
