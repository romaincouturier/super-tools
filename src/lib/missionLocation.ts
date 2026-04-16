/**
 * Conventions partagées pour le champ "Lieu" d'une mission/formation.
 *
 * On stocke "Distanciel" tel quel dans la colonne `location` (text). Aucune
 * colonne dédiée — un simple marker textuel reconnu par les helpers ci-dessous
 * suffit, garde la rétrocompatibilité avec les enregistrements existants
 * et reste lisible à la lecture brute en base.
 */

export const REMOTE_LOCATION_LABEL = "Distanciel";

/** True when the location is "à distance" (pas de logistique physique). */
export function isRemoteLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return location.trim().toLowerCase() === REMOTE_LOCATION_LABEL.toLowerCase();
}
