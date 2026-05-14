-- ═══════════════════════════════════════════════════════════════
-- SuperTilt Order Module — V2 (finances, partenaires) + V3 (stock, dépenses)
-- ═══════════════════════════════════════════════════════════════

-- ── V2 : commission sur chaque ligne de commande ─────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);

-- ── V2 : tokens d'accès partenaires (liens sécurisés) ────────────
CREATE TABLE IF NOT EXISTS public.partner_access_tokens (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id    UUID        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  label      TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage partner_access_tokens"
  ON public.partner_access_tokens FOR ALL TO authenticated USING (true);

-- ── V2 : encaissements partenaires ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_payments (
  id                  UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id             UUID    NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL,
  payment_date        DATE    NOT NULL,
  comment             TEXT,
  status              TEXT    NOT NULL DEFAULT 'declared'
    CHECK (status IN ('declared', 'verified', 'rejected')),
  declared_by         TEXT    NOT NULL DEFAULT 'admin'
    CHECK (declared_by IN ('admin', 'partner')),
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage partner_payments"
  ON public.partner_payments FOR ALL TO authenticated USING (true);

CREATE TRIGGER partner_payments_updated_at
  BEFORE UPDATE ON public.partner_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── V2 : template email réapprovisionnement ───────────────────────
INSERT INTO public.email_templates (template_key, name, subject, body) VALUES
(
  'restock',
  'Email réapprovisionnement',
  'Réapprovisionnement nécessaire — {{nom_jeu}}',
  '<p>Bonjour,</p>
<p>Le stock du jeu <strong>{{nom_jeu}}</strong> est passé sous le seuil minimum.</p>
<p><strong>Stock actuel :</strong> {{stock_actuel}}<br>
<strong>Seuil minimum :</strong> {{seuil_minimum}}</p>
<p><strong>Éléments à commander :</strong></p>
<pre>{{elements_a_commander}}</pre>
<p><strong>Fournisseurs / URLs :</strong></p>
<pre>{{fournisseurs}}</pre>
<p>Cordialement,<br>L''équipe SuperTilt</p>'
)
ON CONFLICT (template_key) DO NOTHING;

-- ── V3 : dépenses par jeu ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_expenses (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id         UUID    NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  expense_date    DATE    NOT NULL,
  expense_type    TEXT    NOT NULL DEFAULT 'autre',
  description     TEXT,
  supplier        TEXT,
  supplier_url    TEXT,
  purchased_by    TEXT,
  amount_ht       NUMERIC(10,2),
  vat_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  amount_ttc      NUMERIC(10,2),
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.game_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage game_expenses"
  ON public.game_expenses FOR ALL TO authenticated USING (true);

CREATE TRIGGER game_expenses_updated_at
  BEFORE UPDATE ON public.game_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_game_expenses_game_id ON public.game_expenses(game_id);

-- ── V3 : stock et réapprovisionnement sur les jeux ───────────────
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS min_stock            INTEGER,
  ADD COLUMN IF NOT EXISTS current_stock        INTEGER,
  ADD COLUMN IF NOT EXISTS restock_threshold    INTEGER,
  ADD COLUMN IF NOT EXISTS restock_items        TEXT,
  ADD COLUMN IF NOT EXISTS restock_supplier_urls TEXT,
  ADD COLUMN IF NOT EXISTS restock_contact_email TEXT;

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_partner_payments_game_id ON public.partner_payments(game_id);
CREATE INDEX IF NOT EXISTS idx_partner_access_tokens_token ON public.partner_access_tokens(token);
