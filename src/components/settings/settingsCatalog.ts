/**
 * Searchable catalog of application settings — single source of truth for the
 * settings search (in-page filter on /parametres + Cmd+K global palette).
 *
 * Each entry points to a tab (the `value` of the Tabs in Parametres.tsx) and,
 * when relevant, an `anchorId` matching the DOM id of the field so the search
 * can scroll to and highlight it.
 */

export type SettingsTabId =
  | "profile"
  | "general"
  | "trainers"
  | "crm"
  | "emails"
  | "access"
  | "integrations"
  | "backup"
  | "billing"
  | "arena"
  | "devis"
  | "voice"
  | "agent"
  | "transcripts"
  | "dropshipping"
  | "checklists";

export const SETTINGS_TAB_LABELS: Record<SettingsTabId, string> = {
  profile: "Mon profil",
  general: "Général",
  trainers: "Formateurs",
  crm: "CRM",
  emails: "Modèles d'emails",
  access: "Accès utilisateurs",
  integrations: "Intégrations",
  backup: "Sauvegarde",
  billing: "Abonnement",
  arena: "AI Arena",
  devis: "Devis",
  voice: "Voix IA",
  agent: "Agent IA",
  transcripts: "Prompts Transcripts",
  dropshipping: "Dropshipping",
  checklists: "Modèles checklist",
};

export interface SettingsCatalogEntry {
  /** Stable id, used in the `?find=` deep link. */
  id: string;
  label: string;
  /** Extra search terms (synonyms, related words). */
  keywords?: string;
  tab: SettingsTabId;
  /** DOM id of the field to scroll to / focus after switching tab. */
  anchorId?: string;
  /** Only surfaced to admins (matches the admin-only tabs in Parametres). */
  adminOnly?: boolean;
}

export const SETTINGS_CATALOG: SettingsCatalogEntry[] = [
  // ── Général : champs individuels (anchorId = id du <Input>) ──────────
  { id: "sentry_dsn", label: "Suivi des erreurs (Sentry) — DSN", keywords: "sentry erreur monitoring observabilité bug tracking crash log", tab: "general", anchorId: "sentry-dsn" },
  { id: "stripe_secret_key", label: "Clé secrète Stripe", keywords: "stripe paiement facturation abonnement clé", tab: "general", anchorId: "stripe-secret-key" },
  { id: "stripe_webhook_secret", label: "Secret webhook Stripe", keywords: "stripe webhook", tab: "general", anchorId: "stripe-webhook-secret" },
  { id: "bcc_email", label: "Email en copie cachée (BCC)", keywords: "bcc copie cachée email envoi", tab: "general", anchorId: "bcc-email" },
  { id: "sender_email", label: "Email de l'expéditeur", keywords: "expéditeur email envoi from", tab: "general", anchorId: "sender-email" },
  { id: "sender_name", label: "Nom de l'expéditeur", keywords: "expéditeur nom", tab: "general", anchorId: "sender-name" },
  { id: "evaluation_notification_email", label: "Email de notification des évaluations", keywords: "évaluation notification email", tab: "general", anchorId: "evaluation-notification-email" },
  { id: "app_url", label: "URL de l'application", keywords: "url lien application email", tab: "general", anchorId: "app-url" },
  { id: "google_maps_api_key", label: "Clé API Google Maps", keywords: "google maps carte api clé", tab: "general", anchorId: "google-maps-api-key" },
  { id: "qualiopi_certificate_path", label: "Chemin certificat Qualiopi", keywords: "qualiopi certificat", tab: "general", anchorId: "qualiopi-path" },
  { id: "google_my_business_url", label: "Fiche Google My Business", keywords: "google avis review business", tab: "general", anchorId: "google-my-business-url" },
  { id: "newsletter_tool_url", label: "Outil de newsletter", keywords: "newsletter brevo mailchimp", tab: "general", anchorId: "newsletter-tool-url" },
  { id: "tva_rate", label: "Taux de TVA", keywords: "tva taxe taux", tab: "general", anchorId: "tva-rate" },
  { id: "website_url", label: "Site web", keywords: "site web url", tab: "general", anchorId: "website-url" },
  { id: "reglement_interieur", label: "Règlement intérieur des formations", keywords: "règlement intérieur pdf formation", tab: "general" },

  // ── Entrées par onglet (navigation directe) ─────────────────────────
  { id: "tab:profile", label: "Mon profil", keywords: "profil prénom nom photo avatar", tab: "profile" },
  { id: "tab:integrations", label: "Intégrations (clés API)", keywords: "api clés siren insee slack pennylane wp statistics fireflies google drive integration", tab: "integrations", adminOnly: true },
  { id: "tab:emails", label: "Modèles d'emails", keywords: "email modèles templates snippets", tab: "emails" },
  { id: "tab:trainers", label: "Formateurs", keywords: "formateur trainer", tab: "trainers" },
  { id: "tab:crm", label: "CRM (couleurs, tags, templates)", keywords: "crm couleurs tags templates email", tab: "crm" },
  { id: "tab:access", label: "Accès utilisateurs", keywords: "accès utilisateurs permissions droits rôles", tab: "access", adminOnly: true },
  { id: "tab:backup", label: "Sauvegarde", keywords: "sauvegarde backup google drive", tab: "backup", adminOnly: true },
  { id: "tab:billing", label: "Abonnement & facturation", keywords: "abonnement facturation plan stripe billing", tab: "billing" },
  { id: "tab:arena", label: "AI Arena (clés API)", keywords: "arena ai openai anthropic clés api", tab: "arena" },
  { id: "tab:devis", label: "Paramètres Devis", keywords: "devis numérotation mentions légales émetteur conditions paiement", tab: "devis" },
  { id: "tab:voice", label: "Voix IA", keywords: "voix vocale synthèse tts", tab: "voice" },
  { id: "tab:agent", label: "Agent IA (indexation)", keywords: "agent ia indexation rag recherche", tab: "agent", adminOnly: true },
  { id: "tab:transcripts", label: "Prompts Transcripts", keywords: "transcripts prompts vidéo", tab: "transcripts", adminOnly: true },
  { id: "tab:dropshipping", label: "Dropshipping", keywords: "dropshipping supertilt commandes", tab: "dropshipping", adminOnly: true },
  { id: "tab:checklists", label: "Modèles de checklist", keywords: "checklist modèles", tab: "checklists" },
];

/** Simple token-AND matcher used by the Cmd+K palette (cmdk filters itself). */
export function matchesSettingQuery(entry: SettingsCatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hay = `${entry.label} ${entry.keywords ?? ""} ${entry.id} ${SETTINGS_TAB_LABELS[entry.tab]}`.toLowerCase();
  return q.split(/\s+/).every((token) => hay.includes(token));
}
