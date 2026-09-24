ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS location_end_date DATE;

COMMENT ON COLUMN public.order_items.location_end_date IS
  'Date de fin courante de la location (repoussée à chaque prolongation).';

CREATE TABLE IF NOT EXISTS public.location_extensions (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id         UUID          NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  sequence              INTEGER       NOT NULL,
  start_date            DATE          NOT NULL,
  end_date              DATE          NOT NULL,
  amount_ht             NUMERIC(10,2) NOT NULL,
  vat_rate              TEXT          NOT NULL DEFAULT 'FR_200',
  contrat_reference     TEXT          NOT NULL,
  contract_file_url     TEXT,
  contract_document_id  TEXT,
  pennylane_invoice_id  TEXT,
  invoice_number        TEXT,
  invoice_url           TEXT,
  signature_status      TEXT CHECK (signature_status IN ('pending', 'signed')),
  signature_sent_at     TIMESTAMPTZ,
  signed_at             TIMESTAMPTZ,
  signed_pdf_url        TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT location_extensions_period_check CHECK (end_date > start_date),
  CONSTRAINT location_extensions_amount_check CHECK (amount_ht >= 0),
  CONSTRAINT location_extensions_sequence_unique UNIQUE (order_item_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_location_extensions_order_item
  ON public.location_extensions (order_item_id);

ALTER TABLE public.location_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage location_extensions" ON public.location_extensions;
CREATE POLICY "Staff manage location_extensions" ON public.location_extensions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

DROP TRIGGER IF EXISTS update_location_extensions_updated_at ON public.location_extensions;
CREATE TRIGGER update_location_extensions_updated_at
  BEFORE UPDATE ON public.location_extensions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.location_contract_signatures
  ADD COLUMN IF NOT EXISTS location_extension_id UUID
    REFERENCES public.location_extensions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_location_contract_signatures_extension
  ON public.location_contract_signatures (location_extension_id);