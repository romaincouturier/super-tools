-- ============================================================
-- Module Devis (Quotes) — tables, indexes, constraints
-- ============================================================

-- 1. Quote settings (singleton — one row per tenant)
CREATE TABLE IF NOT EXISTS quote_settings (
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
  quote_prefix TEXT NOT NULL DEFAULT 'D',
  next_sequence_number INTEGER NOT NULL DEFAULT 1,
  default_validity_days INTEGER NOT NULL DEFAULT 30,
  default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  default_sale_type TEXT NOT NULL DEFAULT 'Prestation de services',
  -- Paiement
  late_penalty_text TEXT NOT NULL DEFAULT 'Pénalités de retard : 3 fois le taux d''intérêt légal',
  recovery_indemnity_amount NUMERIC(10,2) NOT NULL DEFAULT 40.00,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_iban TEXT NOT NULL DEFAULT '',
  bank_bic TEXT NOT NULL DEFAULT '',
  -- Mentions légales
  legal_form TEXT NOT NULL DEFAULT '',
  share_capital TEXT NOT NULL DEFAULT '',
  siren TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  -- Cession de droits
  rights_transfer_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  rights_transfer_clause TEXT NOT NULL DEFAULT 'Le client cède à titre exclusif l''ensemble des droits de propriété intellectuelle sur les livrables produits dans le cadre de la présente prestation, pour une durée illimitée et pour le monde entier.',
  rights_transfer_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_card_id UUID NOT NULL REFERENCES crm_cards(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  sale_type TEXT NOT NULL DEFAULT 'Prestation de services',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'sent', 'signed', 'expired', 'canceled')),
  -- Client info (snapshot at creation)
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
  total_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Rights transfer
  rights_transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  rights_transfer_rate NUMERIC(5,2),
  rights_transfer_amount NUMERIC(12,2),
  -- Loom
  loom_url TEXT,
  -- Email
  email_subject TEXT,
  email_body TEXT,
  email_sent_at TIMESTAMPTZ,
  -- PDF
  pdf_path TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_crm_card ON quotes(crm_card_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);

-- Seed default settings row
INSERT INTO quote_settings (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;
