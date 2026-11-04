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
  "emails_a_valider",
  "marches_publics",
  "support_tickets",
  "supertilt_a_valider",
  "supertilt_recues",
  "supertilt_formation_a_router",
  "supertilt_dropshipping_relance",
  "supertilt_dropshipping",
  "supertilt",
  "lms_communaute",
  "elearning_integration",
  "transcripts_a_affecter",
  "evaluations_froid_bloquees",
] as const;

export const CATEGORIES: Record<string, CategoryConfig> = {
  missions_actions: { label: "Missions \u2014 Actions \u00e0 traiter", emoji: "\u26a1", color: "text-caution-ink" },
  elearning_groupe: { label: "Groupes priv\u00e9s e-learning", emoji: "\ud83d\udcac", color: "text-info-ink" },
  okr_initiatives: { label: "Initiatives OKR", emoji: "\ud83c\udfaf", color: "text-success" },
  reservations_mission: { label: "R\u00e9servations \u00e0 faire", emoji: "\ud83d\ude84", color: "text-info-ink" },
  reservations_formation: { label: "R\u00e9servations formations", emoji: "\ud83c\udf93", color: "text-info-ink" },
  reservations_evenement: { label: "R\u00e9servations \u00e9v\u00e9nements", emoji: "\ud83d\udcc5", color: "text-caution-ink" },
  formations_facture: { label: "Factures \u00e0 \u00e9mettre", emoji: "\ud83e\uddfe", color: "text-danger-ink" },
  missions_a_facturer: { label: "Factures missions", emoji: "\ud83d\udcb0", color: "text-success" },
  missions_activites_non_facturees: { label: "Activit\u00e9s non factur\u00e9es", emoji: "\ud83d\udccb", color: "text-caution-ink" },
  missions_sans_date: { label: "Missions sans date", emoji: "\ud83d\udcc5", color: "text-caution-ink" },
  devis_a_faire: { label: "Devis \u00e0 faire", emoji: "\ud83d\udcdd", color: "text-info-ink" },
  devis_a_relancer: { label: "Devis \u00e0 relancer", emoji: "\ud83d\udd04", color: "text-caution-ink" },
  opportunites: { label: "Opportunit\u00e9s \u00e0 contacter", emoji: "\ud83c\udfaf", color: "text-caution-ink" },
  articles_relire: { label: "Articles \u00e0 relire", emoji: "\ud83d\udccb", color: "text-info-ink" },
  articles_bloques: { label: "Articles bloqu\u00e9s / en attente", emoji: "\u23f8\ufe0f", color: "text-caution-ink" },
  cfp_soumettre: { label: "CFP \u00e0 soumettre", emoji: "\ud83d\udce8", color: "text-caution-ink" },
  formations_conventions: { label: "Formations", emoji: "\ud83c\udf93", color: "text-danger-ink" },
  evenements: { label: "\u00c9v\u00e9nements", emoji: "\ud83d\udcc5", color: "text-info-ink" },
  cfp_surveiller: { label: "CFP \u00e0 surveiller", emoji: "\ud83d\udd01", color: "text-info-ink" },
  emails_a_valider: { label: "Emails à valider", emoji: "\ud83d\udce7", color: "text-info-ink" },
  marches_publics: { label: "Marchés publics", emoji: "⚖️", color: "text-info-ink" },
  support_tickets: { label: "Tickets support", emoji: "\ud83c\udfab", color: "text-danger-ink" },
  supertilt_a_valider: { label: "SuperTilt — commandes à valider", emoji: "\ud83c\udfb2", color: "text-caution-ink" },
  supertilt_recues: { label: "SuperTilt — commandes reçues", emoji: "\ud83d\udce6", color: "text-info-ink" },
  supertilt_formation_a_router: { label: "Formations à router", emoji: "🎓", color: "text-caution-ink" },
  lms_communaute: { label: "Communautés LMS — publications à traiter", emoji: "💬", color: "text-info-ink" },
  elearning_integration: { label: "E-learning — intégration supertilt.fr à corriger", emoji: "🔌", color: "text-danger-ink" },
  supertilt_dropshipping: { label: "SuperTilt — Dropshipping en attente", emoji: "\ud83d\ude9a", color: "text-caution-ink" },
  supertilt_dropshipping_relance: { label: "SuperTilt — Dropshipping relancé", emoji: "\ud83d\udd34", color: "text-danger-ink" },
  transcripts_a_affecter: { label: "Transcripts à affecter", emoji: "🎙️", color: "text-info-ink" },
  evaluations_froid_bloquees: { label: "Évaluations à froid non envoyées", emoji: "🧊", color: "text-danger-ink" },
  supertilt: { label: "SuperTilt", emoji: "\u26a1", color: "text-caution-ink" },
};

export const DEFAULT_CATEGORY_CONFIG: CategoryConfig = {
  label: "",
  emoji: "\ud83d\udccc",
  color: "text-muted-foreground",
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
