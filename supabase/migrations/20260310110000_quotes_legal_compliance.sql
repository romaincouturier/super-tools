-- ============================================================
-- Legal compliance fields for French quotes (devis)
-- Ref: Code de commerce L441-9, Code du travail L6351-1
-- ============================================================

-- 1. Add missing legal fields to quote_settings
ALTER TABLE quote_settings
  ADD COLUMN IF NOT EXISTS rcs_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rcs_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ape_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS training_declaration_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_terms_text TEXT NOT NULL DEFAULT 'Paiement à 30 jours à compter de la date de facturation',
  ADD COLUMN IF NOT EXISTS payment_methods TEXT NOT NULL DEFAULT 'Virement bancaire',
  ADD COLUMN IF NOT EXISTS early_payment_discount TEXT NOT NULL DEFAULT 'Pas d''escompte pour paiement anticipé',
  ADD COLUMN IF NOT EXISTS insurance_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS insurance_coverage_zone TEXT NOT NULL DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS vat_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_exempt_text TEXT NOT NULL DEFAULT 'TVA non applicable, art. 293 B du CGI';

-- 2. Add unit column to line items (stored in JSONB, but we add default_unit to settings)
ALTER TABLE quote_settings
  ADD COLUMN IF NOT EXISTS default_unit TEXT NOT NULL DEFAULT 'jour';

-- 3. Add signature fields to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS client_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS client_signature_date DATE,
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT;
