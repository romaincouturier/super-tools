export const WATCH_EXPERTS = {
  strategie: "Stratège",
  "commercial-reseau": "Commercial et réseau",
  "marketing-seo": "Marketing, contenus et SEO",
  "ic-facilitation": "Intelligence collective et facilitation graphique",
  "pedagogie-qualite": "Pédagogie et qualité (Qualiopi)",
  "ia-supertools": "IA et produit SuperTools",
  productivite: "Cerveau et productivité",
  "daf-juridique": "Finance, compta et juridique",
  evenements: "Événements et conférences",
  concurrence: "Veille concurrentielle",
  newsletters: "Lecture des newsletters",
} as const;

export const WATCH_SOURCE_STATUSES = {
  proposed: "Proposées", to_subscribe: "À abonner", followed: "Suivies", dropped: "Abandonnées",
} as const;
export const WATCH_SOURCE_TYPES = ["newsletter", "podcast", "youtube", "tiktok", "linkedin", "blog", "revue", "site", "autre"] as const;
export const WATCH_SOURCE_LANGUAGES = { fr: "Français", en: "Anglais", autre: "Autre" } as const;
export type WatchExpert = keyof typeof WATCH_EXPERTS;
export type WatchSourceStatus = keyof typeof WATCH_SOURCE_STATUSES;
export type WatchSourceType = typeof WATCH_SOURCE_TYPES[number];
export type WatchSourceLanguage = keyof typeof WATCH_SOURCE_LANGUAGES;

export interface WatchSource {
  id: string;
  created_at: string;
  updated_at: string;
  expert: WatchExpert;
  theme: string;
  name: string;
  type: WatchSourceType;
  language: WatchSourceLanguage;
  url: string;
  why: string;
  how_to_follow: string;
  status: WatchSourceStatus;
  usefulness: number | null;
  items_count: number;
  last_useful_at: string | null;
  proposed_by: string;
  notes: string;
}

export function normalizeWatchSourceUrl(value: string): string {
  const raw = value.trim().toLowerCase();
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol) || /\s/.test(raw) || !parsed.hostname) {
    throw new Error("URL HTTP(S) invalide");
  }
  const withoutFragment = raw.split("#")[0];
  const question = withoutFragment.indexOf("?");
  const base = (question < 0 ? withoutFragment : withoutFragment.slice(0, question)).replace(/\/+$/, "");
  const params = question < 0 ? [] : withoutFragment.slice(question + 1).split("&")
    .filter((p) => p && !p.split("=")[0].startsWith("utm_"));
  return base + (params.length ? `?${params.join("&")}` : "");
}

export function sortWatchSources(sources: WatchSource[]): WatchSource[] {
  const order = Object.keys(WATCH_SOURCE_STATUSES);
  return [...sources].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)
    || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}