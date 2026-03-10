
-- Create quote_settings table (singleton for company/legal settings)
CREATE TABLE public.quote_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Émetteur
  company_name TEXT NOT NULL DEFAULT '',
  company_address TEXT NOT NULL DEFAULT '',
  company_zip TEXT NOT NULL DEFAULT '',
  company_city TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  company_logo_url TEXT,
  -- Numérotation
  quote_prefix TEXT NOT NULL DEFAULT 'DEV',
  next_sequence_number INTEGER NOT NULL DEFAULT 1,
  default_validity_days INTEGER NOT NULL DEFAULT 30,
  default_vat_rate NUMERIC NOT NULL DEFAULT 20,
  default_sale_type TEXT NOT NULL DEFAULT 'prestation',
  -- Paiement
  late_penalty_text TEXT NOT NULL DEFAULT 'En cas de retard de paiement, une pénalité égale à 3 fois le taux d''intérêt légal sera exigible.',
  recovery_indemnity_amount NUMERIC NOT NULL DEFAULT 40,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_iban TEXT NOT NULL DEFAULT '',
  bank_bic TEXT NOT NULL DEFAULT '',
  -- Mentions légales
  legal_form TEXT NOT NULL DEFAULT '',
  share_capital TEXT NOT NULL DEFAULT '',
  siren TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  -- Cession de droits
  rights_transfer_rate NUMERIC NOT NULL DEFAULT 0,
  rights_transfer_clause TEXT NOT NULL DEFAULT '',
  rights_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Conformité légale française
  rcs_number TEXT NOT NULL DEFAULT '',
  rcs_city TEXT NOT NULL DEFAULT '',
  ape_code TEXT NOT NULL DEFAULT '',
  training_declaration_number TEXT NOT NULL DEFAULT '',
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  payment_terms_text TEXT NOT NULL DEFAULT 'Paiement à 30 jours à compter de la date de facturation',
  payment_methods TEXT NOT NULL DEFAULT 'Virement bancaire',
  early_payment_discount TEXT NOT NULL DEFAULT 'Pas d''escompte pour paiement anticipé',
  insurance_name TEXT NOT NULL DEFAULT '',
  insurance_policy_number TEXT NOT NULL DEFAULT '',
  insurance_coverage_zone TEXT NOT NULL DEFAULT 'France',
  vat_exempt BOOLEAN NOT NULL DEFAULT false,
  vat_exempt_text TEXT NOT NULL DEFAULT 'TVA non applicable, art. 293 B du CGI',
  default_unit TEXT NOT NULL DEFAULT 'jour',
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default singleton row
INSERT INTO public.quote_settings (id) VALUES (gen_random_uuid());

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_card_id UUID NOT NULL REFERENCES public.crm_cards(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  sale_type TEXT NOT NULL DEFAULT 'prestation',
  status TEXT NOT NULL DEFAULT 'draft',
  -- Client
  client_company TEXT NOT NULL DEFAULT '',
  client_address TEXT NOT NULL DEFAULT '',
  client_zip TEXT NOT NULL DEFAULT '',
  client_city TEXT NOT NULL DEFAULT '',
  client_vat_number TEXT,
  client_siren TEXT,
  client_email TEXT,
  -- Content
  synthesis TEXT,
  instructions TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Totals
  total_ht NUMERIC NOT NULL DEFAULT 0,
  total_vat NUMERIC NOT NULL DEFAULT 0,
  total_ttc NUMERIC NOT NULL DEFAULT 0,
  -- Rights transfer
  rights_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  rights_transfer_rate NUMERIC,
  rights_transfer_amount NUMERIC,
  -- Loom
  loom_url TEXT,
  -- Email
  email_subject TEXT,
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  -- PDF
  pdf_path TEXT,
  -- Signature client
  client_signature_name TEXT,
  client_signature_date DATE,
  client_signature_data TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.quote_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quote_settings" ON public.quote_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update quote_settings" ON public.quote_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quotes" ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete quotes" ON public.quotes FOR DELETE TO authenticated USING (true);
