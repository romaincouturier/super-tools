// Appels d'offres publics détectés (BOAMP, PLACE, AWS) avant qualification.
// Voir docs/marches-publics.md.

export type TenderStatus = "raw" | "to_review" | "go" | "no_go" | "expired";

/** Motifs de No Go. Liste fermée : c'est la donnée qui affine le filtrage. */
export type TenderNoGoReason =
  | "hors_domaine"
  | "trop_gros"
  | "trop_petit"
  | "delai_trop_court"
  | "criteres_prix"
  | "titulaire_sortant"
  | "geographie"
  | "charge_de_travail"
  | "autre";

export const tenderNoGoReasonConfig: Record<TenderNoGoReason, string> = {
  hors_domaine: "Hors de notre domaine",
  trop_gros: "Marché trop gros pour nous",
  trop_petit: "Montant trop faible",
  delai_trop_court: "Délai de réponse trop court",
  criteres_prix: "Critères trop orientés prix",
  titulaire_sortant: "Titulaire sortant trop installé",
  geographie: "Trop loin géographiquement",
  charge_de_travail: "Pas de disponibilité",
  autre: "Autre",
};

export const tenderSourceConfig: Record<string, string> = {
  boamp: "BOAMP",
  ted: "TED",
  place: "PLACE",
  aws: "AWS",
  mail: "Alerte mail",
};

/** Éléments extraits de l'avis pour décider, par ordre d'utilité décroissante. */
export interface TenderDecisionInfo {
  titulaire?: string | null;
  montant?: number | null;
  duree_mois?: number | null;
  reconductible?: boolean | null;
  criteres?: Array<{ libelle: string; poids: number | null }>;
  lots?: string[];
  url_dce?: string | null;
  contact_email?: string | null;
  ville?: string | null;
  /** Devise du montant : un avis TED peut être libellé en NOK, DKK, PLN… */
  devise?: string | null;
  procedure?: string | null;
  langue?: string | null;
  url_soumission?: string | null;
  site_acheteur?: string | null;
}


export interface TenderOpportunity {
  id: string;
  source: string;
  source_ref: string;
  source_email_id: string | null;
  url_avis: string | null;
  dedup_key: string | null;
  duplicate_of: string | null;
  objet: string | null;
  acheteur: string | null;
  nature: string | null;
  type_marche: string | null;
  famille_libelle: string | null;
  code_departement: string[];
  cpv_codes: string[];
  dateparution: string | null;
  datelimitereponse: string | null;
  decision: TenderDecisionInfo;
  matched_on: string[];
  score: number;
  status: TenderStatus;
  no_go_reason: string | null;
  no_go_detail: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  crm_card_id: string | null;
  /** JSON d'origine de l'avis, lu par la fiche détaillée. */
  raw?: Record<string, unknown> | null;
  /** Synthèse produite à la demande. Absente tant qu'on ne l'a pas demandée. */
  ai_summary: TenderNoticeSummary | null;
  ai_summary_at: string | null;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Opportunité enrichie de l'historique CRM et des attributions du même acheteur. */
export interface TenderWithContext extends TenderOpportunity {
  buyer_history: Array<{
    id: string;
    title: string;
    sales_status: string;
    estimated_value: number | null;
    created_at: string;
  }>;
  /** Attributions passées du même acheteur : titulaire sortant et montant. */
  buyer_awards: Array<{
    id: string;
    objet: string | null;
    titulaire: string;
    montant: number | null;
    dateparution: string | null;
    url_avis: string | null;
  }>;
}


/** Synthèse d'un avis, produite à la demande depuis la fiche. */
export interface TenderNoticeSummary {
  synthese: string;
  attendu: string[];
  criteres: Array<{ libelle: string; poids: string | null }>;
  vigilance: string[];
  adequation: { verdict: string; motif: string };
}

/** Analyse d'une pièce du DCE déposée à la main. */
export interface TenderDocumentAnalysis {
  synthese: string;
  demande: string[];
  contraintes: string[];
  pieces_a_produire: string[];
  vigilance: string[];
}

/** Ligne de `tender_documents`, côté analyse. Le fichier lui-même passe par
 *  le gestionnaire de documents mutualisé. */
export interface TenderDocumentAi {
  id: string;
  file_name: string;
  ai_analysis: TenderDocumentAnalysis | null;
  ai_analysis_at: string | null;
  ai_error: string | null;
}

/** Verdicts d'adéquation, du plus au moins favorable. */
export const tenderAdequacyTone: Record<string, string> = {
  forte: "bg-primary/10 text-primary",
  partielle: "bg-muted text-muted-foreground",
  faible: "bg-destructive/10 text-destructive",
};
