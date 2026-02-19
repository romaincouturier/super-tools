-- Table to track WooCommerce coupons generated for manual e-learning enrollment
CREATE TABLE public.woocommerce_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_code TEXT NOT NULL UNIQUE,
  woocommerce_coupon_id INTEGER,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL,
  catalog_id UUID REFERENCES public.formation_configs(id) ON DELETE SET NULL,
  woocommerce_product_id INTEGER,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  amount NUMERIC NOT NULL DEFAULT 100,
  usage_limit INTEGER NOT NULL DEFAULT 1,
  expiry_date DATE,
  email_restriction TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.woocommerce_coupons ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view woocommerce coupons"
ON public.woocommerce_coupons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert woocommerce coupons"
ON public.woocommerce_coupons FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update woocommerce coupons"
ON public.woocommerce_coupons FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete woocommerce coupons"
ON public.woocommerce_coupons FOR DELETE TO authenticated USING (true);

-- Allow service role (edge functions) full access
CREATE POLICY "Service role full access to woocommerce coupons"
ON public.woocommerce_coupons FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX idx_woocommerce_coupons_participant ON public.woocommerce_coupons(participant_id);
CREATE INDEX idx_woocommerce_coupons_training ON public.woocommerce_coupons(training_id);
CREATE INDEX idx_woocommerce_coupons_catalog ON public.woocommerce_coupons(catalog_id);
CREATE INDEX idx_woocommerce_coupons_code ON public.woocommerce_coupons(coupon_code);

-- Trigger for updated_at
CREATE TRIGGER update_woocommerce_coupons_updated_at
BEFORE UPDATE ON public.woocommerce_coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
