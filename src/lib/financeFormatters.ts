/**
 * Formatters financiers partagés (EUR, conversion sûre en nombre, dates).
 * Source de vérité unique — utilisé par les hooks finance et les composants
 * du module Finances.
 */

export const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Convertit en nombre sûr les valeurs renvoyées par Pennylane (qui mixe
 * `string` et `number` selon les endpoints). Retourne 0 sur null/undefined
 * et sur les valeurs non finies.
 */
export function toNumber(v: string | number | null | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formate une date ISO en `dd/mm/yyyy` (locale fr). Retourne `—` si la date
 * est absente ou invalide.
 */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR");
  } catch {
    return s;
  }
}
