-- ═══════════════════════════════════════════════════════════════
-- Location Contract — PDF Monkey + signature flow
-- ═══════════════════════════════════════════════════════════════

-- ── 1. New fields on games for location contracts ─────────────

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS pdfmonkey_template_id       TEXT,
  ADD COLUMN IF NOT EXISTS location_duree_libelle      TEXT,
  ADD COLUMN IF NOT EXISTS location_duree_jours        INTEGER,
  ADD COLUMN IF NOT EXISTS location_tarif_retard_mois  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS location_prix_remplacement  NUMERIC(10,2);

-- ── 2. New fields on order_items for per-order contract ───────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS location_contract_file_url  TEXT,
  ADD COLUMN IF NOT EXISTS location_document_id        TEXT,
  ADD COLUMN IF NOT EXISTS contrat_reference           TEXT;

-- ── 3. Sequence for contrat_reference (LOC-{year}-{NNN}) ─────

CREATE SEQUENCE IF NOT EXISTS public.location_contract_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.next_location_contract_ref(p_year int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('public.location_contract_ref_seq');
  RETURN 'LOC-' || p_year::text || '-' || lpad(seq_val::text, 3, '0');
END;
$$;

-- ── 4. location_contract_signatures table ────────────────────

CREATE TABLE IF NOT EXISTS public.location_contract_signatures (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token                       TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  order_item_id               UUID        REFERENCES public.order_items(id) ON DELETE SET NULL,
  recipient_email             TEXT        NOT NULL,
  recipient_name              TEXT,
  game_name                   TEXT,
  contrat_reference           TEXT,
  pdf_url                     TEXT,
  signed_pdf_url              TEXT,
  status                      TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'signed', 'expired', 'cancelled')),
  signed_at                   TIMESTAMPTZ,
  email_sent_at               TIMESTAMPTZ,
  email_opened_at             TIMESTAMPTZ,
  expires_at                  TIMESTAMPTZ,
  confirmation_email_sent_at  TIMESTAMPTZ,
  signature_data              TEXT,
  ip_address                  TEXT,
  user_agent                  TEXT,
  audit_metadata              JSONB,
  journey_events              JSONB,
  pdf_hash                    TEXT,
  proof_file_url              TEXT,
  proof_hash                  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.location_contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_contract_signatures_public_select"
  ON public.location_contract_signatures FOR SELECT USING (true);

CREATE POLICY "location_contract_signatures_service_insert"
  ON public.location_contract_signatures FOR INSERT WITH CHECK (true);

CREATE POLICY "location_contract_signatures_service_update"
  ON public.location_contract_signatures FOR UPDATE USING (true);

CREATE TRIGGER update_location_contract_signatures_updated_at
  BEFORE UPDATE ON public.location_contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 5. RPC helpers ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_location_signature_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT row_to_json(s) FROM location_contract_signatures s WHERE s.token = p_token LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.mark_location_signature_opened(p_token text, p_opened_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE location_contract_signatures
  SET email_opened_at = p_opened_at
  WHERE token = p_token AND email_opened_at IS NULL;
$$;

-- ── 6. Default email template for location contract ──────────

INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
VALUES (
  'location_contract',
  'Contrat de location',
  'Contrat de location — {{jeu_nom}}',
  '<p>Bonjour {{prenom_locataire}},</p>
<p>Merci pour votre commande ! Veuillez trouver ci-joint votre contrat de location pour le jeu <strong>{{jeu_nom}}</strong>.</p>
<p>Merci de lire attentivement ce contrat et de le signer électroniquement en cliquant sur le bouton ci-dessous.</p>
{{#signature_link}}
<p style="text-align:center;margin:24px 0">
  <a href="{{signature_link}}" style="display:inline-block;padding:12px 28px;background:#e6bc00;color:#000;text-decoration:none;border-radius:6px;font-weight:bold">✍️ Signer le contrat en ligne</a>
</p>
{{/signature_link}}
<p>Ce lien est valable 30 jours.</p>
<p>Cordialement,<br>L''équipe SuperTilt</p>',
  true
)
ON CONFLICT DO NOTHING;
