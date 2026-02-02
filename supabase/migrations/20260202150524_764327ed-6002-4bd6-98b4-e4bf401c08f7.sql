-- Helper: admin check via SECURITY DEFINER (avoids direct auth.users access in RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'romain@supertilt.fr'
  );
$$;

-- -----------------------------
-- Fix RLS policies on profiles
-- -----------------------------
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update profiles" ON public.profiles;

CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- -------------------------------------
-- Fix RLS policies on user_module_access
-- -------------------------------------
DROP POLICY IF EXISTS "Admin can delete module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can insert module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can update module access" ON public.user_module_access;
DROP POLICY IF EXISTS "Admin can view all module access" ON public.user_module_access;

CREATE POLICY "Admin can view all module access"
ON public.user_module_access
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can insert module access"
ON public.user_module_access
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update module access"
ON public.user_module_access
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete module access"
ON public.user_module_access
FOR DELETE
USING (public.is_admin(auth.uid()));
