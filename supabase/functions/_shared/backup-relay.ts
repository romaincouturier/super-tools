/** Interruptions du worker de sauvegarde faute de mémoire/CPU : reprises au curseur, alerte au-delà du seuil. */
export const RESOURCE_ALERT_THRESHOLD = 3;
export function isResourceLimit(detail: string): boolean {
  return /WORKER_RESOURCE_LIMIT|HTTP 546\b/.test(detail);
}
