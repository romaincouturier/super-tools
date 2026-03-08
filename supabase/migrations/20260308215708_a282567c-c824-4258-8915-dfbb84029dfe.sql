
-- 1) Insert all existing users (from profiles) into org_members for the default org
INSERT INTO public.org_members (org_id, user_id, role)
SELECT o.id, p.user_id, 'owner'
FROM public.profiles p
CROSS JOIN public.organizations o
WHERE o.is_default = true
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 2) Update profiles.org_id to point to the default org
UPDATE public.profiles
SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1)
WHERE org_id IS NULL;

-- 3) Auto-assign new users to the default org on profile creation
CREATE OR REPLACE FUNCTION public.auto_assign_default_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _default_org_id uuid;
BEGIN
  SELECT id INTO _default_org_id FROM public.organizations WHERE is_default = true LIMIT 1;
  IF _default_org_id IS NOT NULL THEN
    -- Set org_id on profile
    NEW.org_id := COALESCE(NEW.org_id, _default_org_id);
    -- Add as member
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (_default_org_id, NEW.user_id, 'collaborator')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_default_org ON public.profiles;
CREATE TRIGGER trg_auto_assign_default_org
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_default_org();
