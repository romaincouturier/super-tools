// Quote (Devis) Module Types

export interface QuoteSettings {
  id: string;
  // Émetteur
  company_name: string;
  company_address: string;
  company_zip: string;
  company_city: string;
  company_email: string;
  company_phone: string;
  company_logo_url: string | null;
  // Numérotation
  quote_prefix: string;
  next_sequence_number: number;
  default_validity_days: number;
  default_vat_rate: number;
  default_sale_type: string;
  // Paiement
  late_penalty_text: string;
  recovery_indemnity_amount: number;
  bank_name: string;
  bank_iban: string;
  bank_bic: string;
  // Mentions légales
  legal_form: string;
  share_capital: string;
  siren: string;
  vat_number: string;
  // Cession de droits
  rights_transfer_rate: number;
  rights_transfer_clause: string;
  rights_transfer_enabled: boolean;
  // Conformité légale française
  rcs_number: string;
  rcs_city: string;
  ape_code: string;
  training_declaration_number: string;
  payment_terms_days: number;
  payment_terms_text: string;
  payment_methods: string;
  early_payment_discount: string;
  insurance_name: string;
  insurance_policy_number: string;
  insurance_coverage_zone: string;
  vat_exempt: boolean;
  vat_exempt_text: string;
  default_unit: string;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type UpdateQuoteSettingsInput = Partial<Omit<QuoteSettings, 'id' | 'created_at' | 'updated_at'>>;

export interface QuoteLineItem {
  id: string;
  product: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  vat_rate: number;
  total_ht: number;
  total_ttc: number;
}

export interface Quote {
  id: string;
  crm_card_id: string;
  quote_number: string;
  issue_date: string;
  expiry_date: string;
  sale_type: string;
  status: QuoteStatus;
  // Client
  client_company: string;
  client_address: string;
  client_zip: string;
  client_city: string;
  client_vat_number: string | null;
  client_siren: string | null;
  client_email: string | null;
  // Content
  synthesis: string | null;
  instructions: string | null;
  line_items: QuoteLineItem[];
  // Totals
  total_ht: number;
  total_vat: number;
  total_ttc: number;
  // Rights transfer
  rights_transfer_enabled: boolean;
  rights_transfer_rate: number | null;
  rights_transfer_amount: number | null;
  // Loom
  loom_url: string | null;
  // Email
  email_subject: string | null;
  email_body: string | null;
  email_sent_at: string | null;
  // PDF
  pdf_path: string | null;
  // Signature client
  client_signature_name: string | null;
  client_signature_date: string | null;
  client_signature_data: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type QuoteStatus = 'draft' | 'generated' | 'sent' | 'signed' | 'expired' | 'canceled';

export interface CreateQuoteInput {
  crm_card_id: string;
  client_company: string;
  client_address: string;
  client_zip: string;
  client_city: string;
  client_vat_number?: string | null;
  client_siren?: string | null;
  client_email?: string | null;
  sale_type?: string;
  expiry_date?: string;
}

export interface UpdateQuoteInput {
  synthesis?: string | null;
  instructions?: string | null;
  line_items?: QuoteLineItem[];
  total_ht?: number;
  total_vat?: number;
  total_ttc?: number;
  rights_transfer_enabled?: boolean;
  rights_transfer_rate?: number | null;
  rights_transfer_amount?: number | null;
  loom_url?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  email_sent_at?: string | null;
  pdf_path?: string | null;
  status?: QuoteStatus;
  expiry_date?: string;
  sale_type?: string;
  // Client updates
  client_company?: string;
  client_address?: string;
  client_zip?: string;
  client_city?: string;
  client_vat_number?: string | null;
  client_siren?: string | null;
  client_email?: string | null;
  // Travel & workflow
  travel_data?: Record<string, unknown>;
  workflow_step?: number;
  challenge_html?: string | null;
}

// SIREN API types
export interface SirenEstablishment {
  siren: string;
  siret: string;
  denominationUniteLegale: string;
  adresseEtablissement: {
    numeroVoieEtablissement: string | null;
    typeVoieEtablissement: string | null;
    libelleVoieEtablissement: string | null;
    codePostalEtablissement: string | null;
    libelleCommuneEtablissement: string | null;
  };
}

// Workflow state
export type QuoteWorkflowStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface QuoteWorkflowState {
  currentStep: QuoteWorkflowStep;
  crmCardId: string;
  quoteId: string | null;
  clientValidated: boolean;
  synthesisValidated: boolean;
  instructionsProvided: boolean;
  quoteGenerated: boolean;
  loomSkipped: boolean;
}
