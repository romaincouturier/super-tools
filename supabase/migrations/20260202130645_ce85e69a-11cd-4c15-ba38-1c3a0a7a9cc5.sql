-- Enum des modules de l'application
CREATE TYPE public.app_module AS ENUM (
  'micro_devis',
  'formations',
  'evaluations',
  'certificates',
  'ameliorations',
  'historique',
  'contenu'
);

-- Table des accès par module
CREATE TABLE public.user_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module app_module NOT NULL,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

-- Fonction SECURITY DEFINER pour vérifier l'accès sans récursion RLS
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = _user_id AND module = _module::app_module
  )
  OR EXISTS (
    -- Romain a toujours accès à tout (admin)
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'romain@supertilt.fr'
  )
$$;

-- RLS Policies pour user_module_access
-- Seul l'admin peut lire/modifier les accès
CREATE POLICY "Admin can view all module access"
ON public.user_module_access
FOR SELECT
TO authenticated
USING (public.has_module_access(auth.uid(), 'micro_devis')); -- Si a accès à un module, peut voir la table

CREATE POLICY "Admin can insert module access"
ON public.user_module_access
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
  )
);

CREATE POLICY "Admin can update module access"
ON public.user_module_access
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
  )
);

CREATE POLICY "Admin can delete module access"
ON public.user_module_access
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
  )
);