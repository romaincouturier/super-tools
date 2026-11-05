-- Perles clients : messages de remerciement et d'éloge reçus, à garder et à
-- faire remonter au hasard sur le tableau de bord des membres du staff qui l'activent.

CREATE TABLE IF NOT EXISTS public.client_pearls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  message TEXT NOT NULL CHECK (length(btrim(message)) > 0),
  message_fr TEXT,
  author_name TEXT,
  author_company TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  pearl_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pearl_time TIME,
  source TEXT NOT NULL DEFAULT 'autre'
    CHECK (source IN ('mail', 'oral', 'linkedin', 'evaluation', 'notion', 'autre')),
  image_path TEXT,
  gmail_thread_id TEXT,
  legacy_notion_id TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_pearls_legacy_notion_id_key
  ON public.client_pearls (legacy_notion_id) WHERE legacy_notion_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_pearls_gmail_thread_id_key
  ON public.client_pearls (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_pearls_date_idx ON public.client_pearls (pearl_date DESC);

CREATE OR REPLACE FUNCTION public.client_pearls_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_pearls_updated_at ON public.client_pearls;
CREATE TRIGGER client_pearls_updated_at
  BEFORE UPDATE ON public.client_pearls
  FOR EACH ROW EXECUTE FUNCTION public.client_pearls_touch_updated_at();

ALTER TABLE public.client_pearls ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le staff (le widget du tableau de bord). Écriture : module supertilt.fr.
DROP POLICY IF EXISTS client_pearls_staff_select ON public.client_pearls;
CREATE POLICY client_pearls_staff_select ON public.client_pearls
  FOR SELECT TO authenticated USING (public.is_staff_user());

DROP POLICY IF EXISTS client_pearls_module_insert ON public.client_pearls;
CREATE POLICY client_pearls_module_insert ON public.client_pearls
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS client_pearls_module_update ON public.client_pearls;
CREATE POLICY client_pearls_module_update ON public.client_pearls
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS client_pearls_module_delete ON public.client_pearls;
CREATE POLICY client_pearls_module_delete ON public.client_pearls
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

-- Tirage au hasard côté base : une seule ligne transite, jamais la liste entière.
-- SECURITY INVOKER : la RLS ci-dessus s'applique, un apprenant ne reçoit rien.
CREATE OR REPLACE FUNCTION public.get_random_client_pearl(p_exclude UUID DEFAULT NULL)
RETURNS SETOF public.client_pearls
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.client_pearls
  WHERE archived = false AND (p_exclude IS NULL OR id <> p_exclude)
  ORDER BY random()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_random_client_pearl(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_random_client_pearl(UUID) TO authenticated;

-- Image optionnelle : bucket privé, lecture staff, écriture module supertilt.fr.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-pearls', 'client-pearls', false, 10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "client_pearls_storage_select" ON storage.objects;
CREATE POLICY "client_pearls_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-pearls' AND public.is_staff_user());

DROP POLICY IF EXISTS "client_pearls_storage_insert" ON storage.objects;
CREATE POLICY "client_pearls_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-pearls'
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr')));

DROP POLICY IF EXISTS "client_pearls_storage_delete" ON storage.objects;
CREATE POLICY "client_pearls_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-pearls'
    AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr')));
