-- ============================================
-- MULTI-TENANT ARCHITECTURE FOR SUPERTOOLS
-- ============================================
-- This migration adds support for multiple organizations
-- with complete data isolation and subscription management

-- ============================================
-- 1. ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 2. SUBSCRIPTION PLANS
-- ============================================
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  monthly_training_limit INTEGER NOT NULL DEFAULT 2,
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 month'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

-- ============================================
-- 3. USAGE TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: '2026-01'
  trainings_created INTEGER DEFAULT 0,
  participants_added INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  certificates_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, month_year)
);

-- ============================================
-- 4. USER PROFILES WITH ORGANIZATION MEMBERSHIP
-- ============================================
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'trainer', 'viewer');

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role user_role NOT NULL DEFAULT 'trainer',
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. TRAINERS TABLE (configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS public.trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  photo_url TEXT,
  specialties TEXT[],
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. EMAIL TEMPLATES (configurable)
-- ============================================
CREATE TYPE email_template_type AS ENUM (
  'needs_survey',
  'needs_survey_reminder',
  'welcome',
  'thank_you',
  'evaluation_reminder',
  'certificate',
  'sponsor_feedback',
  'google_review_request',
  'video_testimonial_request',
  'cold_evaluation',
  'training_documents'
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type email_template_type NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables for this template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, template_type)
);

-- ============================================
-- 7. ADD organization_id TO EXISTING TABLES
-- ============================================

-- Add organization_id to trainings
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to training_participants
ALTER TABLE public.training_participants
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to training_evaluations
ALTER TABLE public.training_evaluations
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to questionnaire_besoins
ALTER TABLE public.questionnaire_besoins
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to improvements
ALTER TABLE public.improvements
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to activity_logs
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to scheduled_emails
ALTER TABLE public.scheduled_emails
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to formation_configs
ALTER TABLE public.formation_configs
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to attendance_signatures
ALTER TABLE public.attendance_signatures
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add trainer_id to trainings (reference to trainers table)
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL;

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trainings_organization ON trainings(organization_id);
CREATE INDEX IF NOT EXISTS idx_participants_organization ON training_participants(organization_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_organization ON training_evaluations(organization_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_organization ON questionnaire_besoins(organization_id);
CREATE INDEX IF NOT EXISTS idx_improvements_organization ON improvements(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_organization ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_organization ON scheduled_emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_trainers_organization ON trainers(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_organization ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization_id);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Get current user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Check if user can create training (within limit)
CREATE OR REPLACE FUNCTION public.can_create_training()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_limit INTEGER;
  v_current_count INTEGER;
  v_month_year TEXT;
  v_plan subscription_plan;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_org_id FROM user_profiles WHERE id = auth.uid();
  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get subscription limit
  SELECT plan, monthly_training_limit INTO v_plan, v_limit
  FROM subscriptions
  WHERE organization_id = v_org_id AND status = 'active';

  -- Enterprise has unlimited
  IF v_plan = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Get current month usage
  v_month_year := to_char(now(), 'YYYY-MM');
  SELECT COALESCE(trainings_created, 0) INTO v_current_count
  FROM usage_tracking
  WHERE organization_id = v_org_id AND month_year = v_month_year;

  RETURN COALESCE(v_current_count, 0) < COALESCE(v_limit, 2);
END;
$$;

-- Increment training count
CREATE OR REPLACE FUNCTION public.increment_training_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_year TEXT;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_month_year := to_char(now(), 'YYYY-MM');

  INSERT INTO usage_tracking (organization_id, month_year, trainings_created)
  VALUES (NEW.organization_id, v_month_year, 1)
  ON CONFLICT (organization_id, month_year)
  DO UPDATE SET
    trainings_created = usage_tracking.trainings_created + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_increment_training_count ON trainings;
CREATE TRIGGER trigger_increment_training_count
AFTER INSERT ON trainings
FOR EACH ROW
EXECUTE FUNCTION increment_training_count();

-- ============================================
-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_besoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE formation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_signatures ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id = get_user_organization_id());

CREATE POLICY "Owners can update own organization"
  ON organizations FOR UPDATE
  USING (id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Subscriptions: Users can view their organization's subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Usage tracking: Users can view their organization's usage
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (organization_id = get_user_organization_id());

-- User profiles: Users can see profiles in their organization
CREATE POLICY "Users can view org profiles"
  ON user_profiles FOR SELECT
  USING (organization_id = get_user_organization_id() OR id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can manage org profiles"
  ON user_profiles FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Trainers: Organization isolation
CREATE POLICY "Users can view org trainers"
  ON trainers FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage trainers"
  ON trainers FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Email templates: Organization isolation
CREATE POLICY "Users can view org templates"
  ON email_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage templates"
  ON email_templates FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Trainings: Organization isolation
CREATE POLICY "Users can view org trainings"
  ON trainings FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can manage org trainings"
  ON trainings FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'trainer'));

-- Training participants: Organization isolation
CREATE POLICY "Users can view org participants"
  ON training_participants FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can manage org participants"
  ON training_participants FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'trainer'));

-- Evaluations: Organization isolation + public access for submission
CREATE POLICY "Users can view org evaluations"
  ON training_evaluations FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Public can submit evaluations"
  ON training_evaluations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update own evaluation"
  ON training_evaluations FOR UPDATE
  USING (true);

-- Questionnaires: Organization isolation + public access
CREATE POLICY "Users can view org questionnaires"
  ON questionnaire_besoins FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Public can submit questionnaires"
  ON questionnaire_besoins FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update questionnaires"
  ON questionnaire_besoins FOR UPDATE
  USING (true);

-- Improvements: Organization isolation
CREATE POLICY "Users can view org improvements"
  ON improvements FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can manage org improvements"
  ON improvements FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin', 'trainer'));

-- Activity logs: Organization isolation
CREATE POLICY "Users can view org logs"
  ON activity_logs FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can insert logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Scheduled emails: Organization isolation
CREATE POLICY "Users can view org emails"
  ON scheduled_emails FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Users can manage org emails"
  ON scheduled_emails FOR ALL
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

-- Formation configs: Organization isolation
CREATE POLICY "Users can view org configs"
  ON formation_configs FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Admins can manage configs"
  ON formation_configs FOR ALL
  USING (organization_id = get_user_organization_id() AND get_user_role() IN ('owner', 'admin'));

-- Attendance signatures: Organization isolation + public submission
CREATE POLICY "Users can view org signatures"
  ON attendance_signatures FOR SELECT
  USING (organization_id = get_user_organization_id() OR organization_id IS NULL);

CREATE POLICY "Public can submit signatures"
  ON attendance_signatures FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 11. DEFAULT EMAIL TEMPLATES (inserted per org)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_email_templates(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Needs Survey Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'needs_survey',
    'Questionnaire de besoins',
    'Pr\u00e9paration de votre formation {{training_name}}',
    '<p>Bonjour {{participant_first_name}},</p>
<p>Vous \u00eates inscrit(e) \u00e0 la formation <strong>{{training_name}}</strong> qui aura lieu le {{training_date}}.</p>
<p>Afin de personnaliser au mieux cette formation, nous vous invitons \u00e0 remplir ce court questionnaire :</p>
<p><a href="{{survey_link}}">Acc\u00e9der au questionnaire</a></p>
<p>Merci de le compl\u00e9ter avant le {{deadline}}.</p>
<p>Cordialement,<br>{{trainer_name}}</p>',
    '["participant_first_name", "training_name", "training_date", "survey_link", "deadline", "trainer_name"]'
  );

  -- Welcome Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'welcome',
    'Email de bienvenue',
    'Bienvenue \u00e0 la formation {{training_name}}',
    '<p>Bonjour {{participant_first_name}},</p>
<p>Votre formation <strong>{{training_name}}</strong> approche !</p>
<p><strong>Date :</strong> {{training_date}}<br>
<strong>Lieu :</strong> {{training_location}}<br>
<strong>Horaires :</strong> {{training_hours}}</p>
<p>N''h\u00e9sitez pas \u00e0 nous contacter si vous avez des questions.</p>
<p>\u00c0 tr\u00e8s bient\u00f4t,<br>{{trainer_name}}</p>',
    '["participant_first_name", "training_name", "training_date", "training_location", "training_hours", "trainer_name"]'
  );

  -- Thank You Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'thank_you',
    'Remerciement post-formation',
    'Merci pour votre participation \u00e0 {{training_name}}',
    '<p>Bonjour {{participant_first_name}},</p>
<p>Merci d''avoir particip\u00e9 \u00e0 la formation <strong>{{training_name}}</strong>.</p>
<p>Votre avis est pr\u00e9cieux. Merci de prendre quelques minutes pour compl\u00e9ter cette \u00e9valuation :</p>
<p><a href="{{evaluation_link}}">\u00c9valuer la formation</a></p>
<p>Cordialement,<br>{{trainer_name}}</p>',
    '["participant_first_name", "training_name", "evaluation_link", "trainer_name"]'
  );

  -- Evaluation Reminder Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'evaluation_reminder',
    'Relance \u00e9valuation',
    'Rappel : \u00c9valuez votre formation {{training_name}}',
    '<p>Bonjour {{participant_first_name}},</p>
<p>Nous n''avons pas encore re\u00e7u votre \u00e9valuation pour la formation <strong>{{training_name}}</strong>.</p>
<p>Votre retour nous aide \u00e0 am\u00e9liorer nos formations. Cela ne prend que 2 minutes :</p>
<p><a href="{{evaluation_link}}">\u00c9valuer la formation</a></p>
<p>Merci,<br>{{trainer_name}}</p>',
    '["participant_first_name", "training_name", "evaluation_link", "trainer_name"]'
  );

  -- Certificate Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'certificate',
    'Envoi certificat',
    'Votre certificat de formation - {{training_name}}',
    '<p>Bonjour {{participant_first_name}},</p>
<p>Veuillez trouver ci-joint votre certificat de r\u00e9alisation pour la formation <strong>{{training_name}}</strong>.</p>
<p>Cordialement,<br>{{trainer_name}}</p>',
    '["participant_first_name", "training_name", "trainer_name"]'
  );

  -- Sponsor Feedback Template
  INSERT INTO email_templates (organization_id, template_type, name, subject, body_html, variables)
  VALUES (
    p_org_id,
    'sponsor_feedback',
    'Feedback commanditaire',
    'Votre avis sur la formation {{training_name}}',
    '<p>Bonjour {{sponsor_first_name}},</p>
<p>La formation <strong>{{training_name}}</strong> s''est termin\u00e9e le {{end_date}}.</p>
<p>Dans le cadre de notre d\u00e9marche qualit\u00e9 Qualiopi, nous souhaitons recueillir votre avis :</p>
<p><a href="{{feedback_link}}">Donner mon avis</a></p>
<p>Cordialement,<br>{{trainer_name}}</p>',
    '["sponsor_first_name", "training_name", "end_date", "feedback_link", "trainer_name"]'
  );

END;
$$;

-- ============================================
-- 12. ORGANIZATION SETUP FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.setup_new_organization(
  p_org_name TEXT,
  p_org_slug TEXT,
  p_owner_id UUID,
  p_owner_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug)
  VALUES (p_org_name, p_org_slug)
  RETURNING id INTO v_org_id;

  -- Create subscription (free tier)
  INSERT INTO subscriptions (organization_id, plan, status, monthly_training_limit)
  VALUES (v_org_id, 'free', 'active', 2);

  -- Create/update user profile as owner
  INSERT INTO user_profiles (id, organization_id, email, role)
  VALUES (p_owner_id, v_org_id, p_owner_email, 'owner')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = v_org_id,
    role = 'owner',
    updated_at = now();

  -- Create default trainer
  INSERT INTO trainers (organization_id, user_id, name, email, is_default)
  VALUES (v_org_id, p_owner_id, split_part(p_owner_email, '@', 1), p_owner_email, true);

  -- Create default email templates
  PERFORM create_default_email_templates(v_org_id);

  RETURN v_org_id;
END;
$$;

-- ============================================
-- 13. AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 14. COMMENTS
-- ============================================
COMMENT ON TABLE organizations IS 'Organizations/companies using SuperTools';
COMMENT ON TABLE subscriptions IS 'Subscription plans per organization';
COMMENT ON TABLE usage_tracking IS 'Monthly usage tracking per organization';
COMMENT ON TABLE user_profiles IS 'User profiles with organization membership';
COMMENT ON TABLE trainers IS 'Trainers per organization (configurable)';
COMMENT ON TABLE email_templates IS 'Customizable email templates per organization';
COMMENT ON FUNCTION can_create_training IS 'Check if user can create training within subscription limit';
COMMENT ON FUNCTION setup_new_organization IS 'Initialize a new organization with defaults';
