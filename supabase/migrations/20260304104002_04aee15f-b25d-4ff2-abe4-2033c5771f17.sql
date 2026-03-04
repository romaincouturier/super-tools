CREATE TABLE public.woocommerce_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL,
  woocommerce_coupon_id integer,
  participant_id uuid NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  catalog_id uuid,
  woocommerce_product_id integer,
  discount_type text DEFAULT 'percent',
  amount numeric DEFAULT 100,
  usage_limit integer DEFAULT 1,
  expiry_date date,
  email_restriction text,
  status text DEFAULT 'active',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_woocommerce_coupons_participant ON public.woocommerce_coupons(participant_id);
CREATE INDEX idx_woocommerce_coupons_training ON public.woocommerce_coupons(training_id);

ALTER TABLE public.woocommerce_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read coupons"
  ON public.woocommerce_coupons FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert coupons"
  ON public.woocommerce_coupons FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON public.woocommerce_coupons FOR ALL
  TO service_role USING (true) WITH CHECK (true);