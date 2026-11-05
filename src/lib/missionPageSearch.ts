import type { MissionPage } from "@/hooks/useMissions";

export interface MissionPageSearchResult {
  /** Identifiants des pages dont le titre ou le contenu correspond au terme. */
  matchIds: Set<string>;
  /** Identifiants affichés : les correspondances et tous leurs parents. */
  visibleIds: Set<string>;
}

/** Minuscules, sans accents ni espaces multiples. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Contenu HTML d'une page réduit à son texte. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|td|blockquote|pre|table)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cherche un terme dans le titre et le contenu des pages d'une mission.
 * Les parents d'une correspondance sont rendus visibles pour garder le contexte.
 */
export function searchMissionPages(pages: MissionPage[], term: string): MissionPageSearchResult {
  const needle = normalizeForSearch(term);
  if (!needle) return { matchIds: new Set(), visibleIds: new Set() };

  const matchIds = new Set<string>();
  for (const page of pages) {
    const haystack = normalizeForSearch(`${page.title || ""} ${htmlToPlainText(page.content || "")}`);
    if (haystack.includes(needle)) matchIds.add(page.id);
  }

  const byId = new Map(pages.map((p) => [p.id, p]));
  const visibleIds = new Set<string>();
  for (const id of matchIds) {
    visibleIds.add(id);
    const visited = new Set<string>([id]);
    let current = byId.get(id);
    while (current?.parent_page_id && !visited.has(current.parent_page_id)) {
      visited.add(current.parent_page_id);
      visibleIds.add(current.parent_page_id);
      current = byId.get(current.parent_page_id);
    }
  }

  return { matchIds, visibleIds };
}
