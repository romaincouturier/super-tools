-- ═══════════════════════════════════════════════════════════════
-- SuperTilt Order Module — V1
-- Extends the existing games/authors tables and adds order
-- management tables for the WooCommerce integration.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Extend game_authors ───────────────────────────────────────
ALTER TABLE public.game_authors
  ADD COLUMN IF NOT EXISTS secondary_email TEXT;

-- ── 2. Extend games ──────────────────────────────────────────────
-- Drop old status constraint to allow 'to_check'
ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_status_check;

ALTER TABLE public.games
  ADD CONSTRAINT games_status_check
    CHECK (status IN ('active', 'inactive', 'to_check'));

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS game_type           TEXT    NOT NULL DEFAULT 'dropshipping'
    CHECK (game_type IN ('supertilt', 'dropshipping', 'location', 'partner')),
  ADD COLUMN IF NOT EXISTS woocommerce_product_url TEXT,
  ADD COLUMN IF NOT EXISTS secondary_author_email  TEXT,
  ADD COLUMN IF NOT EXISTS custom_message          TEXT,
  ADD COLUMN IF NOT EXISTS processing_instructions TEXT,
  ADD COLUMN IF NOT EXISTS is_partner              BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_name            TEXT,
  ADD COLUMN IF NOT EXISTS partner_email           TEXT,
  ADD COLUMN IF NOT EXISTS commission_type         TEXT    DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed', 'formula')),
  ADD COLUMN IF NOT EXISTS commission_rate         NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS commission_fixed        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS commission_formula      TEXT,
  ADD COLUMN IF NOT EXISTS include_stripe_fees     BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. woocommerce_orders — full raw order ───────────────────────
CREATE TABLE IF NOT EXISTS public.woocommerce_orders (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  wc_order_id          INTEGER     NOT NULL UNIQUE,
  order_number         TEXT,
  wc_status            TEXT        NOT NULL,
  date_created         TIMESTAMPTZ NOT NULL,
  customer_first_name  TEXT,
  customer_last_name   TEXT,
  customer_email       TEXT,
  billing_address      JSONB,
  shipping_address     JSONB,
  total_ttc            NUMERIC(10,2),
  total_ht             NUMERIC(10,2),
  total_tax            NUMERIC(10,2),
  shipping_total       NUMERIC(10,2),
  payment_method       TEXT,
  payment_method_title TEXT,
  line_items           JSONB,
  raw_order            JSONB       NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at         TIMESTAMPTZ
);

ALTER TABLE public.woocommerce_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage woocommerce_orders"
  ON public.woocommerce_orders FOR ALL TO authenticated USING (true);

-- ── 4. order_items — one row per line item per order ────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  woocommerce_order_id UUID        REFERENCES public.woocommerce_orders(id) ON DELETE CASCADE,
  wc_order_id          INTEGER     NOT NULL,
  wc_product_id        INTEGER     NOT NULL,
  product_name         TEXT,
  game_id              UUID        REFERENCES public.games(id) ON DELETE SET NULL,
  game_type            TEXT,
  quantity             INTEGER     NOT NULL DEFAULT 1,
  unit_price           NUMERIC(10,2),
  line_total           NUMERIC(10,2),
  -- Kanban state
  kanban_status        TEXT        NOT NULL DEFAULT 'to_validate'
    CHECK (kanban_status IN (
      'to_validate', 'received', 'to_ship',
      'dropshipping', 'location_pending', 'processed', 'blocked'
    )),
  block_reason         TEXT,
  validation_status    TEXT        NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  -- Email tracking
  email_sent_at        TIMESTAMPTZ,
  email_sent_to        TEXT,
  -- Metadata
  notes                TEXT,
  raw_line_item        JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage order_items"
  ON public.order_items FOR ALL TO authenticated USING (true);

CREATE TRIGGER order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. email_templates — NOTE ────────────────────────────────────
-- La table email_templates existait déjà (module formations).
-- Les templates SuperTilt sont dans supertilt_email_templates,
-- créée par la migration 20260514130000_supertilt_email_templates_fix.sql

-- ── 6. order_email_log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_email_log (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id   UUID        REFERENCES public.order_items(id) ON DELETE SET NULL,
  wc_order_id     INTEGER,
  template_key    TEXT,
  sent_to         TEXT[],
  cc              TEXT[],
  subject         TEXT,
  body            TEXT,
  status          TEXT        NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed')),
  error           TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage order_email_log"
  ON public.order_email_log FOR ALL TO authenticated USING (true);

-- ── 7. supertilt_settings — module configuration ─────────────────
CREATE TABLE IF NOT EXISTS public.supertilt_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supertilt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage supertilt_settings"
  ON public.supertilt_settings FOR ALL TO authenticated USING (true);

-- Default settings
INSERT INTO public.supertilt_settings (key, value) VALUES
  ('wc_statuses_to_process', '["completed","processing"]'),
  ('auto_send_emails', 'false'),
  ('internal_email', '""'),
  ('default_sender', '"noreply@supertilt.fr"'),
  ('vat_rate', '0.20'),
  ('stripe_fee_rate', '0.014'),
  ('stripe_fee_fixed', '0.25'),
  ('default_currency', '"EUR"')
ON CONFLICT (key) DO NOTHING;

-- ── 8. Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_items_kanban_status ON public.order_items(kanban_status);
CREATE INDEX IF NOT EXISTS idx_order_items_game_id ON public.order_items(game_id);
CREATE INDEX IF NOT EXISTS idx_order_items_wc_order_id ON public.order_items(wc_order_id);
CREATE INDEX IF NOT EXISTS idx_woocommerce_orders_date ON public.woocommerce_orders(date_created DESC);
