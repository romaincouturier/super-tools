import type { AppModule } from "@/hooks/useModuleAccess";

export interface SubNavItem {
  key: string;
  sectionLabel?: string;
  /** Module de droits, quand le sous-item n'est qu'une vue d'un module existant. */
  module?: AppModule;
}

export interface NavGroupConfig {
  type: "group";
  key: string;
  children: SubNavItem[];
}

export interface NavItemConfig {
  type: "item";
  key: string;
}

export type NavConfig = NavGroupConfig | NavItemConfig;


/**
 * Trie la nav par popularité globale (clics 90 jours, tous utilisateurs),
 * de la plus cliquée à la moins cliquée. Les groupes sont classés sur le
 * total parent + enfants, et leurs sous-items sont triés aussi. Sans stats
 * (table vide, RPC indisponible), l'ordre de NAV_CONFIG est conservé
 * (tri stable, tout le monde à 0).
 */
/** Segments d'avant le renommage des modules (03/11/2026) : leurs clics comptent pour le nouveau. */
const LEGACY_SEGMENTS: Record<string, string[]> = {
  "supertilt-fr": ["contenu", "transcripts", "temoignages"],
  "projets-transverses": ["supertilt"],
};

export function sortNavByUsage(
  config: NavConfig[],
  counts: Map<string, number>,
  pathOf: (key: string) => string | undefined,
): NavConfig[] {
  /** Segment de chemin d'une entrée ("/crm/..." -> "crm"), pour matcher les stats d'usage. */
  const pathSegment = (key: string): string | null => pathOf(key)?.split("/")[1] || null;
  const segmentClicks = (seg: string): number =>
    [seg, ...(LEGACY_SEGMENTS[seg] ?? [])].reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const clicksOf = (key: string): number => {
    const seg = pathSegment(key);
    return seg ? segmentClicks(seg) : 0;
  };
  // Un groupe compte chaque segment une seule fois : ses sous-items peuvent
  // partager le segment du parent (/supertilt-fr/...).
  const entryClicks = (entry: NavConfig): number => {
    if (entry.type !== "group") return clicksOf(entry.key);
    const segs = new Set(
      [entry.key, ...entry.children.map((c) => c.key)]
        .map(pathSegment)
        .filter((s): s is string => !!s),
    );
    return [...segs].reduce((s, seg) => s + segmentClicks(seg), 0);
  };

  return [...config]
    .map((entry) =>
      entry.type === "group"
        ? { ...entry, children: [...entry.children].sort((a, b) => clicksOf(b.key) - clicksOf(a.key)) }
        : entry,
    )
    .sort((a, b) => entryClicks(b) - entryClicks(a));
}
