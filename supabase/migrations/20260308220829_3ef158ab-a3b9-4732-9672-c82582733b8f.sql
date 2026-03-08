
-- Billing plans configuration
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  stripe_price_id text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric,
  currency text NOT NULL DEFAULT 'eur',
  max_trainings integer,
  max_participants integer,
  max_storage_mb integer,
  max_emails_per_month integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_plans_public_read" ON public.billing_plans FOR SELECT USING (true);

-- Organization subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_org_read" ON public.subscriptions FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Usage tracking per org per month
CREATE TABLE public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  trainings_count integer NOT NULL DEFAULT 0,
  participants_count integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  storage_used_mb numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period_start)
);

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_records_org_read" ON public.usage_records FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

-- Seed default plans
INSERT INTO public.billing_plans (name, slug, price_monthly, price_yearly, max_trainings, max_participants, max_storage_mb, max_emails_per_month, features, display_order)
VALUES
  ('Free', 'free', 0, 0, 1, 5, 100, 50, '["1 formation", "5 participants", "Questionnaires de besoins", "Évaluations", "Certificats PDF"]'::jsonb, 0),
  ('Pro', 'pro', 29, 290, null, null, 5000, 1000, '["Formations illimitées", "Participants illimités", "CRM intégré", "Émargement numérique", "Conventions auto", "Support prioritaire"]'::jsonb, 1),
  ('Business', 'business', 79, 790, null, null, 50000, 10000, '["Tout Pro inclus", "Multi-utilisateurs", "API & Zapier", "Marque blanche emails", "Analytics avancés", "Support dédié"]'::jsonb, 2);

-- Triggers for updated_at
CREATE TRIGGER update_billing_plans_updated_at BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_usage_records_updated_at BEFORE UPDATE ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
