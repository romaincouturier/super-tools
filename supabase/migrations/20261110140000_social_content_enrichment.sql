-- Contenus sociaux, lot 1 : titre interne, brief visuel, classement (expertises
-- multi-valeurs + catégorie), sources, notes internes et préparation éditoriale.
-- Ajouts uniquement : aucune ligne existante n'est modifiée. Le statut de
-- diffusion reste indépendant de la date (20261110120000) et de la préparation.

-- ── Colonnes du contenu ────────────────────────────────────────
ALTER TABLE public.social_content_groups
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS editorial_category TEXT,
  ADD COLUMN IF NOT EXISTS visual_type TEXT,
  ADD COLUMN IF NOT EXISTS visual_message TEXT,
  ADD COLUMN IF NOT EXISTS visual_elements TEXT,
  ADD COLUMN IF NOT EXISTS visual_texts TEXT,
  ADD COLUMN IF NOT EXISTS visual_composition TEXT,
  ADD COLUMN IF NOT EXISTS visual_slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS check_text_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_visual_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_links_checked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS check_proofread BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by UUID,
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'app';

ALTER TABLE public.social_content_groups DROP CONSTRAINT IF EXISTS social_content_groups_title_length;
ALTER TABLE public.social_content_groups ADD CONSTRAINT social_content_groups_title_length
  CHECK (title IS NULL OR char_length(title) <= 120);
ALTER TABLE public.social_content_groups DROP CONSTRAINT IF EXISTS social_content_groups_editorial_category_check;
ALTER TABLE public.social_content_groups ADD CONSTRAINT social_content_groups_editorial_category_check
  CHECK (editorial_category IS NULL OR editorial_category IN
    ('tutorial', 'reflection', 'resource', 'behind_the_scenes', 'humor', 'community', 'offer'));
ALTER TABLE public.social_content_groups DROP CONSTRAINT IF EXISTS social_content_groups_visual_type_check;
ALTER TABLE public.social_content_groups ADD CONSTRAINT social_content_groups_visual_type_check
  CHECK (visual_type IS NULL OR visual_type IN
    ('illustration', 'sketchnote', 'carousel', 'photo', 'video', 'diagram', 'other'));
ALTER TABLE public.social_content_groups DROP CONSTRAINT IF EXISTS social_content_groups_visual_slides_array;
ALTER TABLE public.social_content_groups ADD CONSTRAINT social_content_groups_visual_slides_array
  CHECK (jsonb_typeof(visual_slides) = 'array');
ALTER TABLE public.social_content_groups DROP CONSTRAINT IF EXISTS social_content_groups_origin_check;
ALTER TABLE public.social_content_groups ADD CONSTRAINT social_content_groups_origin_check
  CHECK (origin IN ('app', 'ai'));

COMMENT ON COLUMN public.social_content_groups.theme_id IS 'DEPRECATED: replaced by social_content_group_themes (expertises multi-valeurs)';
COMMENT ON COLUMN public.social_content_groups.origin IS 'app ou ai : une création par l''IA (lot 2) reste en Brouillon, imposé en base';

-- Une case décochée annule la validation, quel que soit le chemin d'écriture.
CREATE OR REPLACE FUNCTION public.social_content_groups_reset_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT (NEW.check_text_ready AND NEW.check_visual_ready AND NEW.check_links_checked AND NEW.check_proofread) THEN
    NEW.validated_at := NULL;
    NEW.validated_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS social_content_groups_reset_validation ON public.social_content_groups;
CREATE TRIGGER social_content_groups_reset_validation
  BEFORE INSERT OR UPDATE ON public.social_content_groups
  FOR EACH ROW EXECUTE FUNCTION public.social_content_groups_reset_validation();

-- ── Expertises (thèmes multi-valeurs) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.social_content_group_themes (
  group_id UUID NOT NULL REFERENCES public.social_content_groups(id) ON DELETE CASCADE,
  theme_id UUID NOT NULL REFERENCES public.social_themes(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, theme_id)
);
CREATE INDEX IF NOT EXISTS social_content_group_themes_theme_idx ON public.social_content_group_themes (theme_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_group_themes TO authenticated;
GRANT ALL ON public.social_content_group_themes TO service_role;
ALTER TABLE public.social_content_group_themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_content_group_themes_module_all ON public.social_content_group_themes;
CREATE POLICY social_content_group_themes_module_all ON public.social_content_group_themes
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

-- ── Sources ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.social_content_groups(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  label TEXT,
  content_card_id UUID REFERENCES public.content_cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_content_sources_url_format CHECK (url IS NULL OR url ~* '^https?://[^[:space:]]+$'),
  CONSTRAINT social_content_sources_label_length CHECK (label IS NULL OR char_length(label) <= 200)
);
CREATE INDEX IF NOT EXISTS social_content_sources_group_idx ON public.social_content_sources (group_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_content_sources TO authenticated;
GRANT ALL ON public.social_content_sources TO service_role;
ALTER TABLE public.social_content_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_content_sources_module_all ON public.social_content_sources;
CREATE POLICY social_content_sources_module_all ON public.social_content_sources
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'supertilt_fr'));

-- ── Enregistrement : p_details facultatif ──────────────────────
-- p_details (chaque clé absente = valeur conservée) :
-- { title, editorial_category, visual_type, visual_message, visual_elements,
--   visual_texts, visual_composition, visual_slides: [{content}], internal_notes,
--   check_text_ready, check_visual_ready, check_links_checked, check_proofread,
--   theme_ids: [uuid], sources: [{url, label, content_card_id}] }
DROP FUNCTION IF EXISTS public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.save_social_content_group(
  p_group_id UUID,
  p_format TEXT,
  p_sync BOOLEAN,
  p_posts JSONB,
  p_theme_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_channels UUID[];
  v_theme_id UUID;
  v_title TEXT;
BEGIN
  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'Identifiant de contenu manquant' USING ERRCODE = '22004';
  END IF;

  IF p_posts IS NULL OR jsonb_typeof(p_posts) <> 'array' OR jsonb_array_length(p_posts) = 0 THEN
    RAISE EXCEPTION 'Choisissez au moins un canal' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_posts) AS elem
     WHERE elem ? 'publication_status'
       AND COALESCE(elem->>'publication_status', '') NOT IN ('unscheduled', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'Statut invalide : Brouillon ou Programmé' USING ERRCODE = '22023';
  END IF;

  -- Contrôles des détails, avec des messages lisibles par une API.
  IF p_details IS NOT NULL THEN
    IF jsonb_typeof(p_details) <> 'object' THEN
      RAISE EXCEPTION 'Détails invalides' USING ERRCODE = '22023';
    END IF;
    v_title := NULLIF(btrim(p_details->>'title'), '');
    IF v_title IS NOT NULL AND char_length(v_title) > 120 THEN
      RAISE EXCEPTION 'Le titre interne ne dépasse pas 120 caractères' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(p_details->>'editorial_category', '') IS NOT NULL AND p_details->>'editorial_category' NOT IN
       ('tutorial', 'reflection', 'resource', 'behind_the_scenes', 'humor', 'community', 'offer') THEN
      RAISE EXCEPTION 'Catégorie éditoriale inconnue' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(p_details->>'visual_type', '') IS NOT NULL AND p_details->>'visual_type' NOT IN
       ('illustration', 'sketchnote', 'carousel', 'photo', 'video', 'diagram', 'other') THEN
      RAISE EXCEPTION 'Type de visuel inconnu' USING ERRCODE = '22023';
    END IF;
    IF p_details ? 'visual_slides' AND (
         jsonb_typeof(p_details->'visual_slides') <> 'array'
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_details->'visual_slides') s
                     WHERE jsonb_typeof(s) <> 'object' OR jsonb_typeof(s->'content') IS DISTINCT FROM 'string')
       ) THEN
      RAISE EXCEPTION 'Diapositives invalides : liste de { content }' USING ERRCODE = '22023';
    END IF;
    IF p_details ? 'sources' AND (
         jsonb_typeof(p_details->'sources') <> 'array'
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_details->'sources') s
                     WHERE NULLIF(btrim(s->>'url'), '') IS NOT NULL AND btrim(s->>'url') !~* '^https?://[^[:space:]]+$')
       ) THEN
      RAISE EXCEPTION 'Adresse de source invalide : elle commence par http:// ou https://' USING ERRCODE = '22023';
    END IF;
    IF p_details ? 'theme_ids' AND jsonb_typeof(p_details->'theme_ids') <> 'array' THEN
      RAISE EXCEPTION 'Expertises invalides : liste d''identifiants' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT array_agg(DISTINCT (elem->>'channel_id')::uuid)
    INTO v_channels
    FROM jsonb_array_elements(p_posts) AS elem;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_posts) AS elem
      LEFT JOIN public.social_posts sp
        ON sp.group_id = p_group_id AND sp.channel_id = (elem->>'channel_id')::uuid
     WHERE NULLIF(elem->>'scheduled_at', '') IS NULL
       AND COALESCE(sp.publication_status, '') <> 'published'
       AND COALESCE(elem->>'publication_status', sp.publication_status, 'unscheduled') = 'scheduled'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_posts) AS elem
       WHERE elem->>'publication_status' = 'scheduled' AND NULLIF(elem->>'scheduled_at', '') IS NULL
    ) THEN
      RAISE EXCEPTION 'Indiquez une date et une heure pour programmer' USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'Repassez en Brouillon avant de retirer la date' USING ERRCODE = '23514';
  END IF;

  SELECT t.id INTO v_theme_id FROM public.social_themes t WHERE t.id = p_theme_id FOR KEY SHARE;

  INSERT INTO public.social_content_groups (id, format, sync, theme_id)
  VALUES (p_group_id, COALESCE(p_format, 'post'), COALESCE(p_sync, true), v_theme_id)
  ON CONFLICT (id) DO UPDATE SET format = EXCLUDED.format, sync = EXCLUDED.sync, theme_id = EXCLUDED.theme_id;

  IF p_details IS NOT NULL THEN
    UPDATE public.social_content_groups g SET
      title = CASE WHEN p_details ? 'title' THEN v_title ELSE g.title END,
      editorial_category = CASE WHEN p_details ? 'editorial_category' THEN NULLIF(p_details->>'editorial_category', '') ELSE g.editorial_category END,
      visual_type = CASE WHEN p_details ? 'visual_type' THEN NULLIF(p_details->>'visual_type', '') ELSE g.visual_type END,
      visual_message = CASE WHEN p_details ? 'visual_message' THEN NULLIF(p_details->>'visual_message', '') ELSE g.visual_message END,
      visual_elements = CASE WHEN p_details ? 'visual_elements' THEN NULLIF(p_details->>'visual_elements', '') ELSE g.visual_elements END,
      visual_texts = CASE WHEN p_details ? 'visual_texts' THEN NULLIF(p_details->>'visual_texts', '') ELSE g.visual_texts END,
      visual_composition = CASE WHEN p_details ? 'visual_composition' THEN NULLIF(p_details->>'visual_composition', '') ELSE g.visual_composition END,
      visual_slides = CASE WHEN p_details ? 'visual_slides'
        THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('content', s->>'content') ORDER BY ord), '[]'::jsonb)
                FROM jsonb_array_elements(p_details->'visual_slides') WITH ORDINALITY AS x(s, ord))
        ELSE g.visual_slides END,
      internal_notes = CASE WHEN p_details ? 'internal_notes' THEN NULLIF(p_details->>'internal_notes', '') ELSE g.internal_notes END,
      check_text_ready = CASE WHEN p_details ? 'check_text_ready' THEN COALESCE((p_details->>'check_text_ready')::boolean, false) ELSE g.check_text_ready END,
      check_visual_ready = CASE WHEN p_details ? 'check_visual_ready' THEN COALESCE((p_details->>'check_visual_ready')::boolean, false) ELSE g.check_visual_ready END,
      check_links_checked = CASE WHEN p_details ? 'check_links_checked' THEN COALESCE((p_details->>'check_links_checked')::boolean, false) ELSE g.check_links_checked END,
      check_proofread = CASE WHEN p_details ? 'check_proofread' THEN COALESCE((p_details->>'check_proofread')::boolean, false) ELSE g.check_proofread END
     WHERE g.id = p_group_id;

    IF p_details ? 'theme_ids' THEN
      DELETE FROM public.social_content_group_themes WHERE group_id = p_group_id;
      INSERT INTO public.social_content_group_themes (group_id, theme_id)
      SELECT DISTINCT p_group_id, t.id
        FROM jsonb_array_elements_text(p_details->'theme_ids') AS x(tid)
        JOIN public.social_themes t ON t.id::text = x.tid;
    END IF;

    IF p_details ? 'sources' THEN
      DELETE FROM public.social_content_sources WHERE group_id = p_group_id;
      INSERT INTO public.social_content_sources (group_id, position, url, label, content_card_id)
      SELECT p_group_id, (ord - 1)::int,
             NULLIF(btrim(s->>'url'), ''),
             NULLIF(btrim(s->>'label'), ''),
             (SELECT c.id FROM public.content_cards c WHERE c.id::text = NULLIF(s->>'content_card_id', ''))
        FROM jsonb_array_elements(p_details->'sources') WITH ORDINALITY AS x(s, ord)
       WHERE NULLIF(btrim(s->>'url'), '') IS NOT NULL OR NULLIF(s->>'content_card_id', '') IS NOT NULL;
    END IF;
  END IF;

  DELETE FROM public.social_posts
   WHERE group_id = p_group_id
     AND NOT (channel_id = ANY (v_channels))
     AND publication_status <> 'published';

  INSERT INTO public.social_posts (group_id, channel_id, text, scheduled_at, publication_status, media_id)
  SELECT DISTINCT ON (channel_id)
         p_group_id, channel_id, text, scheduled_at,
         COALESCE(requested_status,
           (SELECT sp.publication_status FROM public.social_posts sp
             WHERE sp.group_id = p_group_id AND sp.channel_id = src.channel_id),
           'unscheduled'),
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
             NULLIF(elem->>'publication_status', '') AS requested_status,
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

REVOKE ALL ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID, JSONB) TO authenticated;

-- ── Validation éditoriale ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_social_content(p_group_id UUID, p_validated BOOLEAN)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ready BOOLEAN;
  v_at TIMESTAMPTZ;
BEGIN
  SELECT check_text_ready AND check_visual_ready AND check_links_checked AND check_proofread
    INTO v_ready
    FROM public.social_content_groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contenu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_validated, false) AND NOT v_ready THEN
    RAISE EXCEPTION 'Cochez toutes les étapes de préparation avant de valider' USING ERRCODE = '23514';
  END IF;

  UPDATE public.social_content_groups
     SET validated_at = CASE WHEN p_validated THEN now() ELSE NULL END,
         validated_by = CASE WHEN p_validated THEN auth.uid() ELSE NULL END
   WHERE id = p_group_id
  RETURNING validated_at INTO v_at;
  RETURN v_at;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_social_content(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_social_content(UUID, BOOLEAN) TO authenticated;
