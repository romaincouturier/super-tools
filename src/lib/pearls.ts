/** "4 novembre 2026" ou "4 novembre 2026 à 09:34" si l'heure est connue. */
export function formatPearlDate(date: string, time?: string | null): string {
  const d = new Date(`${date}T12:00:00`);
  const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return time ? `${label} à ${time.slice(0, 5)}` : label;
}
