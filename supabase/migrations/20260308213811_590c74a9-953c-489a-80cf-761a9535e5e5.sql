
-- ============================================================
-- M1: Organizations + org_members + helpers
-- ============================================================

-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_default boolean DEFAULT false,
  plan text DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  settings jsonb DEFAULT '{}',
  max_participants integer DEFAULT 5,
  max_active_trainings integer DEFAULT 1,
  storage_limit_mb integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Org members table
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'collaborator', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- 3. Enable RLS on both
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 4. Organizations RLS
CREATE POLICY "org_select_members" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members om WHERE om.org_id = id AND om.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "org_manage_admins" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Org members RLS
CREATE POLICY "orgm_select" ON public.org_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.org_members om2 WHERE om2.org_id = org_members.org_id AND om2.user_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "orgm_manage_admins" ON public.org_members
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 6. Add org_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- 7. Helper: get user org
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.org_members WHERE user_id = _user_id ORDER BY created_at ASC LIMIT 1;
$$;

-- 8. Helper: feature flag check
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_flag text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT setting_value = 'true' FROM public.app_settings WHERE setting_key = _flag), false);
$$;

-- 9. Updated_at trigger
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
