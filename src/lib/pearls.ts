import type { Pearl } from "@/services/pearls";

/** "4 novembre 2026" ou "4 novembre 2026 à 09:34" si l'heure est connue. */
export function formatPearlDate(date: string, time?: string | null): string {
  const d = new Date(`${date}T12:00:00`);
  const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return time ? `${label} à ${time.slice(0, 5)}` : label;
}

export interface PearlFilters {
  search: string;
  source: string;
  tone: string;
  showArchived: boolean;
}

/** Filtre la liste de la page Perles : archivage, source, ton (positive / hors tableau de bord), texte. */
export function filterPearls(pearls: Pearl[], f: PearlFilters): Pearl[] {
  const q = f.search.trim().toLowerCase();
  return pearls.filter((p) => {
    if (!f.showArchived && p.archived) return false;
    if (f.source !== "all" && p.source !== f.source) return false;
    if (f.tone === "positive" && !p.is_positive) return false;
    if (f.tone === "other" && p.is_positive) return false;
    if (!q) return true;
    return [p.title, p.message, p.message_fr, p.author_name, p.author_company]
      .some((v) => v?.toLowerCase().includes(q));
  });
}
