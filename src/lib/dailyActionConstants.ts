// ── Daily Action Constants ──
// Category configuration, display order, and type definitions for daily actions.

export interface CategoryConfig {
  label: string;
  emoji: string;
  color: string;
}

/** Display order for categories (matches daily digest email order) */
export const CATEGORY_ORDER = [
  "missions_actions",
  "formations_facture",
  "missions_a_facturer",
  "missions_activites_non_facturees",
  "elearning_groupe",
  "okr_initiatives",
  "reservations_mission",
  "reservations_formation",
  "reservations_evenement",
  "cfp_soumettre",
  "missions_sans_date",
  "devis_a_faire",
  "devis_a_relancer",
  "opportunites",
  "articles_relire",
  "articles_bloques",
  "formations_conventions",
  "commentaires_contenu",
  "evenements",
  "cfp_surveiller",
  "supertilt",
] as const;

export const CATEGORIES: Record<string, CategoryConfig> = {
  missions_actions: { label: "Missions \u2014 Actions \u00e0 traiter", emoji: "\u26a1", color: "text-orange-600" },
  elearning_groupe: { label: "Groupes priv\u00e9s e-learning", emoji: "\ud83d\udcac", color: "text-indigo-600" },
  okr_initiatives: { label: "Initiatives OKR", emoji: "\ud83c\udfaf", color: "text-emerald-600" },
  reservations_mission: { label: "R\u00e9servations \u00e0 faire", emoji: "\ud83d\ude84", color: "text-sky-600" },
  reservations_formation: { label: "R\u00e9servations formations", emoji: "\ud83c\udf93", color: "text-sky-600" },
  reservations_evenement: { label: "R\u00e9servations \u00e9v\u00e9nements", emoji: "\ud83d\udcc5", color: "text-amber-600" },
  formations_facture: { label: "Factures \u00e0 \u00e9mettre", emoji: "\ud83e\uddfe", color: "text-red-600" },
  missions_a_facturer: { label: "Factures missions", emoji: "\ud83d\udcb0", color: "text-green-600" },
  missions_activites_non_facturees: { label: "Activit\u00e9s non factur\u00e9es", emoji: "\ud83d\udccb", color: "text-amber-600" },
  missions_sans_date: { label: "Missions sans date", emoji: "\ud83d\udcc5", color: "text-orange-600" },
  devis_a_faire: { label: "Devis \u00e0 faire", emoji: "\ud83d\udcdd", color: "text-blue-600" },
  devis_a_relancer: { label: "Devis \u00e0 relancer", emoji: "\ud83d\udd04", color: "text-orange-600" },
  opportunites: { label: "Opportunit\u00e9s \u00e0 contacter", emoji: "\ud83c\udfaf", color: "text-amber-600" },
  articles_relire: { label: "Articles \u00e0 relire", emoji: "\ud83d\udccb", color: "text-purple-600" },
  articles_bloques: { label: "Articles bloqu\u00e9s / en attente", emoji: "\u23f8\ufe0f", color: "text-yellow-600" },
  cfp_soumettre: { label: "CFP \u00e0 soumettre", emoji: "\ud83d\udce8", color: "text-orange-600" },
  formations_conventions: { label: "Formations", emoji: "\ud83c\udf93", color: "text-red-600" },
  evenements: { label: "\u00c9v\u00e9nements", emoji: "\ud83d\udcc5", color: "text-teal-600" },
  cfp_surveiller: { label: "CFP \u00e0 surveiller", emoji: "\ud83d\udd01", color: "text-blue-600" },
  supertilt: { label: "SuperTilt", emoji: "\u26a1", color: "text-yellow-600" },
};

export const DEFAULT_CATEGORY_CONFIG: CategoryConfig = {
  label: "",
  emoji: "\ud83d\udccc",
  color: "text-gray-600",
};

/** Get config for a category, falling back to defaults */
export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORIES[category] ?? { ...DEFAULT_CATEGORY_CONFIG, label: category };
}

// ── Shared types ──

export interface DailyAction {
  id: string;
  category: string;
  title: string;
  description: string | null;
  link: string | null;
  is_completed: boolean;
  completed_at: string | null;
  auto_completed: boolean;
}

export interface CategoryAnalytics {
  label: string;
  avg_completion_minutes: number | null;
  total: number;
  completed: number;
}

export interface DailyAnalytics {
  total_actions: number;
  completed_count: number;
  category_stats: Record<string, CategoryAnalytics>;
}
