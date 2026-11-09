-- Contenus sociaux : thèmes éditoriaux colorés, portés par le contenu (le
-- groupe), pas par la déclinaison. Liste vide au départ, gérée par tout
-- utilisateur du module. Supprimer un thème laisse les contenus intacts, sans
-- thème (ON DELETE SET NULL).

-- ── Thèmes ─────────────────────────────────────────────────────
-- Blancs : espaces, tabulations, retours ligne et blancs Unicode (espace
-- insécable compris), comme String.prototype.trim côté front. Le nom ne peut
-- pas en être fait uniquement, et l'unicité ignore la casse et les blancs de
-- bord, avec la même classe.
CREATE TABLE IF NOT EXISTS public.social_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_themes DROP CONSTRAINT IF EXISTS social_themes_name_not_blank;
ALTER TABLE public.social_themes ADD CONSTRAINT social_themes_name_not_blank
  CHECK (name !~ '^[[:space:]\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]*$');

DROP INDEX IF EXISTS public.social_themes_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS social_themes_name_key ON public.social_themes (lower(regexp_replace(
  name,
  '^[[:space:]\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+|[[:space:]\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+$',
  '',
  'g'
)));

DROP TRIGGER IF EXISTS social_themes_updated_at ON public.social_themes;
CREATE TRIGGER social_themes_updated_at
  BEFORE UPDATE ON public.social_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Thème d'un contenu ─────────────────────────────────────────
ALTER TABLE public.social_content_groups
  ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES public.social_themes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS social_content_groups_theme_id_idx ON public.social_content_groups (theme_id);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.social_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_themes_module_select ON public.social_themes;
CREATE POLICY social_themes_module_select ON public.social_themes
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_themes_module_insert ON public.social_themes;
CREATE POLICY social_themes_module_insert ON public.social_themes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_themes_module_update ON public.social_themes;
CREATE POLICY social_themes_module_update ON public.social_themes
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

DROP POLICY IF EXISTS social_themes_module_delete ON public.social_themes;
CREATE POLICY social_themes_module_delete ON public.social_themes
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

-- ── Enregistrement atomique d'un groupe et de ses posts ────────
-- Corps identique à 20261106100000, avec le thème du groupe en dernier
-- paramètre. Les migrations de l'epic ne sont pas en production : aucun ancien
-- front n'appelle la signature à quatre paramètres, retirée ici.
-- Thème inconnu (supprimé entre-temps, ou invisible par la RLS) : null, comme
-- pour media_id. Le thème trouvé est verrouillé (FOR KEY SHARE) jusqu'à la fin
-- de la transaction : une suppression concurrente attend, puis remet le
-- contenu à null, au lieu d'une violation de clé étrangère.
DROP FUNCTION IF EXISTS public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.save_social_content_group(
  p_group_id UUID,
  p_format TEXT,
  p_sync BOOLEAN,
  p_posts JSONB,
  p_theme_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_channels UUID[];
  v_theme_id UUID;
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

  SELECT t.id INTO v_theme_id FROM public.social_themes t WHERE t.id = p_theme_id FOR KEY SHARE;

  INSERT INTO public.social_content_groups (id, format, sync, theme_id)
  VALUES (p_group_id, COALESCE(p_format, 'post'), COALESCE(p_sync, true), v_theme_id)
  ON CONFLICT (id) DO UPDATE SET format = EXCLUDED.format, sync = EXCLUDED.sync, theme_id = EXCLUDED.theme_id;

  DELETE FROM public.social_posts
   WHERE group_id = p_group_id
     AND NOT (channel_id = ANY (v_channels))
     AND publication_status <> 'published';

  INSERT INTO public.social_posts (group_id, channel_id, text, scheduled_at, publication_status, media_id)
  SELECT DISTINCT ON (channel_id)
         p_group_id, channel_id, text, scheduled_at,
         CASE WHEN scheduled_at IS NULL THEN 'unscheduled' ELSE 'scheduled' END,
         CASE WHEN has_media THEN
           (SELECT m.id FROM public.media m WHERE m.id = requested_media_id)
         ELSE
           (SELECT sp.media_id FROM public.social_posts sp
             WHERE sp.group_id = p_group_id AND sp.channel_id = src.channel_id)
         END
    FROM (
      SELECT (elem->>'channel_id')::uuid AS channel_id,
             COALESCE(elem->>'text', '') AS text,
             NULLIF(elem->>'scheduled_at', '')::timestamptz AS scheduled_at,
             NULLIF(elem->>'media_id', '')::uuid AS requested_media_id,
             elem ? 'media_id' AS has_media
        FROM jsonb_array_elements(p_posts) AS elem
    ) AS src
  ON CONFLICT (group_id, channel_id) DO UPDATE
     SET text = EXCLUDED.text,
         scheduled_at = EXCLUDED.scheduled_at,
         publication_status = EXCLUDED.publication_status,
         media_id = EXCLUDED.media_id
   WHERE public.social_posts.publication_status <> 'published';

  RETURN p_group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID) TO authenticated;
