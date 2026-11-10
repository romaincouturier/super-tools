ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_status_matches_date;
ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_status_matches_date
  CHECK (publication_status <> 'scheduled' OR scheduled_at IS NOT NULL);

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

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_posts) AS elem
     WHERE elem ? 'publication_status'
       AND COALESCE(elem->>'publication_status', '') NOT IN ('unscheduled', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'Statut invalide : Brouillon ou Programmé' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_social_group_date(
  p_group_id UUID,
  p_scheduled_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.social_content_groups WHERE id = p_group_id) THEN
    RAISE EXCEPTION 'Contenu introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF p_scheduled_at IS NULL AND EXISTS (
    SELECT 1 FROM public.social_posts WHERE group_id = p_group_id AND publication_status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'Repassez en Brouillon avant de retirer la date' USING ERRCODE = '23514';
  END IF;

  UPDATE public.social_posts
     SET scheduled_at = p_scheduled_at
   WHERE group_id = p_group_id
     AND publication_status <> 'published';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_group_date(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_social_group_date(UUID, TIMESTAMPTZ) TO authenticated;