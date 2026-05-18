-- Feature: elearning access mode toggle + WooCommerce formation webhook

-- 1. Extend learner_magic_links with training_id (to pre-select formation in portal)
ALTER TABLE public.learner_magic_links
  ADD COLUMN IF NOT EXISTS training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL;

-- 2. New RPC: peek at token without consuming it (for onboarding page)
CREATE OR REPLACE FUNCTION public.preview_learner_token(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link learner_magic_links;
BEGIN
  SELECT * INTO v_link FROM learner_magic_links WHERE token = p_token LIMIT 1;
  IF v_link IS NULL THEN
    RETURN json_build_object('status', 'invalid');
  END IF;
  IF v_link.used_at IS NOT NULL THEN
    RETURN json_build_object('status', 'used');
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN json_build_object('status', 'expired');
  END IF;
  RETURN json_build_object(
    'status', 'ok',
    'email', v_link.email,
    'training_id', v_link.training_id
  );
END;
$$;

-- 3. RPC: consume token after successful auth
CREATE OR REPLACE FUNCTION public.consume_learner_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE learner_magic_links
  SET used_at = now()
  WHERE token = p_token AND used_at IS NULL;
END;
$$;

-- 4. Allow anon to call the new preview function
GRANT EXECUTE ON FUNCTION public.preview_learner_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.consume_learner_token(text) TO anon;

-- 5. WooCommerce pending formations (orders with no matching session)
CREATE TABLE public.woocommerce_pending_formations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  woocommerce_order_id INTEGER NOT NULL,
  woocommerce_product_id INTEGER NOT NULL,
  customer_email TEXT NOT NULL,
  customer_first_name TEXT,
  customer_last_name TEXT,
  formation_name TEXT,
  reason TEXT NOT NULL DEFAULT 'no_matching_session',
  raw_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_wc_pending_formations_product ON public.woocommerce_pending_formations(woocommerce_product_id);
CREATE INDEX idx_wc_pending_formations_email   ON public.woocommerce_pending_formations(customer_email);
CREATE INDEX idx_wc_pending_formations_status  ON public.woocommerce_pending_formations(status);

ALTER TABLE public.woocommerce_pending_formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage pending formations"
  ON public.woocommerce_pending_formations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Default value for elearning_access_mode in app_settings (if not present)
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'elearning_access_mode',
  'woocommerce',
  'Mode d''accès e-learning : "woocommerce" (email avec lien WooCommerce) ou "magic_link" (lien magique vers espace apprenant)'
)
ON CONFLICT (setting_key) DO NOTHING;
