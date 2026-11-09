-- Contenus sociaux : visuel de chaque déclinaison, choisi dans la Médiathèque.
-- Le visuel est une référence vers `media` ; la suppression du média remet la
-- référence à NULL, ce qui fait réapparaître l'alerte « visuel manquant ».
-- Tant que la synchro du groupe est active, la base recopie texte et visuel
-- vers les autres déclinaisons non publiées, comme pour le texte seul.

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES public.media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS social_posts_media_id_idx ON public.social_posts (media_id);

-- ── Propagation du texte et du visuel dans un groupe synchronisé ─
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
     SET text = NEW.text,
         media_id = NEW.media_id
   WHERE group_id = NEW.group_id
     AND id <> NEW.id
     AND publication_status <> 'published'
     AND (text IS DISTINCT FROM NEW.text OR media_id IS DISTINCT FROM NEW.media_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_propagate_text ON public.social_posts;
CREATE TRIGGER social_posts_propagate_text
  AFTER UPDATE OF text, media_id ON public.social_posts
  FOR EACH ROW
  WHEN (OLD.text IS DISTINCT FROM NEW.text OR OLD.media_id IS DISTINCT FROM NEW.media_id)
  EXECUTE FUNCTION public.social_posts_propagate_text();

-- ── Enregistrement atomique d'un groupe et de ses posts ────────
-- Identique à la version de 20261105120000, avec le visuel de chaque post.
-- Clé `media_id` absente : le visuel existant est conservé (null à la
-- création) ; la valeur conservée est relue dans la sous-requête, EXCLUDED
-- ne voyant que les colonnes de la table. Identifiant inconnu de `media` (supprimé entre-temps) : ramené
-- à null plutôt qu'une violation de clé étrangère.
-- p_posts : [{ "channel_id": uuid, "text": text, "scheduled_at": timestamptz|null, "media_id": uuid|null }]
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

REVOKE ALL ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_social_content_group(UUID, TEXT, BOOLEAN, JSONB) TO authenticated;
