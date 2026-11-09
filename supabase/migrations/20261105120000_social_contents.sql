-- Contenus sociaux (supertilt.fr) : un contenu rédigé une fois, décliné sur
-- plusieurs canaux. Un groupe porte ce qui est commun (format, synchro, auteur),
-- un post par canal porte le texte propre, la date et le statut de publication.
-- Tant que la synchro du groupe est active, la base recopie le texte modifié
-- d'un post vers les autres posts non publiés du groupe.

-- ── Canaux ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  abbreviation TEXT NOT NULL CHECK (length(btrim(abbreviation)) > 0),
  text_limit INTEGER CHECK (text_limit IS NULL OR text_limit > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.social_channels (slug, name, abbreviation, text_limit, sort_order) VALUES
  ('linkedin_romain', 'LinkedIn Romain', 'LI', 3000, 10),
  ('linkedin_emmanuelle', 'LinkedIn Emmanuelle', 'LI', 3000, 20),
  ('linkedin_supertilt', 'Page LinkedIn SuperTilt', 'LI', 3000, 30),
  ('instagram', 'Instagram', 'IN', 2200, 40),
  ('youtube', 'YouTube', 'YO', 5000, 50),
  ('facebook', 'Facebook', 'FA', 63206, 60),
  ('blog', 'Blog', 'Blog', NULL, 70),
  ('declic', 'Le Déclic', 'Déclic', NULL, 80)
ON CONFLICT (slug) DO NOTHING;

-- ── Groupes de contenu ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_content_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL DEFAULT 'post' CHECK (format IN ('post', 'story', 'reel')),
  sync BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Posts (une déclinaison par canal) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.social_content_groups(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.social_channels(id) ON DELETE RESTRICT,
  text TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  publication_status TEXT NOT NULL DEFAULT 'unscheduled'
    CHECK (publication_status IN ('unscheduled', 'scheduled', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_posts_group_channel_key UNIQUE (group_id, channel_id),
  CONSTRAINT social_posts_status_matches_date CHECK (
    (publication_status <> 'unscheduled' OR scheduled_at IS NULL)
    AND (publication_status <> 'scheduled' OR scheduled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS social_posts_scheduled_at_idx ON public.social_posts (scheduled_at);

-- ── updated_at ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS social_content_groups_updated_at ON public.social_content_groups;
CREATE TRIGGER social_content_groups_updated_at
  BEFORE UPDATE ON public.social_content_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS social_posts_updated_at ON public.social_posts;
CREATE TRIGGER social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Propagation du texte dans un groupe synchronisé ────────────
-- SECURITY INVOKER : la RLS de l'appelant s'applique à la recopie.
-- Le garde de profondeur empêche la recopie de se redéclencher elle-même.
-- Une déclinaison publiée n'est jamais réécrite, et sa modification ne se
-- propage pas.
CREATE OR REPLACE FUNCTION public.social_posts_propagate_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() <> 1 OR NEW.publication_status = 'published' THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.social_content_groups g WHERE g.id = NEW.group_id AND g.sync
  ) THEN
    RETURN NULL;
  END IF;
  UPDATE public.social_posts
     SET text = NEW.text
   WHERE group_id = NEW.group_id
     AND id <> NEW.id
     AND publication_status <> 'published'
     AND text IS DISTINCT FROM NEW.text;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_propagate_text ON public.social_posts;
CREATE TRIGGER social_posts_propagate_text
  AFTER UPDATE OF text ON public.social_posts
  FOR EACH ROW
  WHEN (OLD.text IS DISTINCT FROM NEW.text)
  EXECUTE FUNCTION public.social_posts_propagate_text();

-- ── Enregistrement atomique d'un groupe et de ses posts ────────
-- L'identifiant du groupe est fourni par le client : la sauvegarde continue
-- réécrit le même groupe, sans doublon. Les canaux décochés perdent leur post,
-- un groupe sans canal est refusé. Une déclinaison publiée n'est ni réécrite
-- ni supprimée.
-- p_posts : [{ "channel_id": uuid, "text": text, "scheduled_at": timestamptz|null }]
CREATE OR REPLACE FUNCTION public.save_social_content_group(
  p_group_id UUID,
  p_format TEXT,
  p_sync BOOLEAN,
  p_posts JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_channels UUID[];
BEGIN
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de contenu manquant' USING ERRCODE = '22004';
  END IF;

  IF p_posts IS NULL OR jsonb_typeof(p_posts) <> 'array' OR jsonb_array_length(p_posts) = 0 THEN
    RAISE EXCEPTION 'Choisissez au moins un canal' USING ERRCODE = '23514';
  END IF;

  SELECT array_agg(DISTINCT (elem->>'channel_id')::uuid)
    INTO v_channels
    FROM jsonb_array_elements(p_posts) AS elem;

  INSERT INTO public.social_content_groups (id, format, sync)
  VALUES (p_group_id, COALESCE(p_format, 'post'), COALESCE(p_sync, true))
  ON CONFLICT (id) DO UPDATE SET format = EXCLUDED.format, sync = EXCLUDED.sync;

  DELETE FROM public.social_posts
   WHERE group_id = p_group_id
     AND NOT (channel_id = ANY (v_channels))
     AND publication_status <> 'published';

  INSERT INTO public.social_posts (group_id, channel_id, text, scheduled_at, publication_status)
  SELECT DISTINCT ON (channel_id)
         p_group_id, channel_id, text, scheduled_at,
         CASE WHEN scheduled_at IS NULL THEN 'unscheduled' ELSE 'scheduled' END
    FROM (
      SELECT (elem->>'channel_id')::uuid AS channel_id,
             COALESCE(elem->>'text', '') AS text,
             NULLIF(elem->>'scheduled_at', '')::timestamptz AS scheduled_at
        FROM jsonb_array_elements(p_posts) AS elem
    ) AS src
  ON CONFLICT (group_id, channel_id) DO UPDATE
     SET text = EXCLUDED.text,
         scheduled_at = EXCLUDED.scheduled_at,
         publication_status = EXCLUDED.publication_status
   WHERE public.social_posts.publication_status <> 'published';

  RETURN p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB) TO authenticated;

-- ── RLS : module supertilt.fr ou admin ─────────────────────────
-- Les canaux sont une liste de référence partagée : lecture par le module,
-- écriture réservée aux admins.
ALTER TABLE public.social_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_content_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_channels_module_select ON public.social_channels;
CREATE POLICY social_channels_module_select ON public.social_channels
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_channels_admin_insert ON public.social_channels;
CREATE POLICY social_channels_admin_insert ON public.social_channels
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS social_channels_admin_update ON public.social_channels;
CREATE POLICY social_channels_admin_update ON public.social_channels
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS social_channels_admin_delete ON public.social_channels;
CREATE POLICY social_channels_admin_delete ON public.social_channels
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS social_content_groups_module_select ON public.social_content_groups;
CREATE POLICY social_content_groups_module_select ON public.social_content_groups
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_content_groups_module_insert ON public.social_content_groups;
CREATE POLICY social_content_groups_module_insert ON public.social_content_groups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_content_groups_module_update ON public.social_content_groups;
CREATE POLICY social_content_groups_module_update ON public.social_content_groups
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_content_groups_module_delete ON public.social_content_groups;
CREATE POLICY social_content_groups_module_delete ON public.social_content_groups
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_posts_module_select ON public.social_posts;
CREATE POLICY social_posts_module_select ON public.social_posts
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_posts_module_insert ON public.social_posts;
CREATE POLICY social_posts_module_insert ON public.social_posts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_posts_module_update ON public.social_posts;
CREATE POLICY social_posts_module_update ON public.social_posts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_posts_module_delete ON public.social_posts;
CREATE POLICY social_posts_module_delete ON public.social_posts
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));
