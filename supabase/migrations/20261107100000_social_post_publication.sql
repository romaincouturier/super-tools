-- Contenus sociaux : marquer une déclinaison publiée (et l'annuler), modifier
-- seule une déclinaison publiée, et supprimer le contenu devenu vide.
-- Toutes les fonctions sont SECURITY INVOKER : la RLS de l'appelant s'applique.
-- Une ligne invisible pour l'appelant est refusée plutôt qu'ignorée en silence.

-- ── Marquage publié d'une seule déclinaison ────────────────────
-- Marquer : 'published', refusé sans date. Annuler : 'scheduled' si la
-- déclinaison est datée, 'unscheduled' sinon. Les autres déclinaisons du
-- groupe ne changent pas, et la propagation ne se déclenche pas (elle n'écoute
-- que text et media_id).
CREATE OR REPLACE FUNCTION public.set_social_post_published(
  p_post_id UUID,
  p_published BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_scheduled_at TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  IF p_published IS NULL THEN
    RAISE EXCEPTION 'Marquage manquant' USING ERRCODE = '22004';
  END IF;

  SELECT scheduled_at INTO v_scheduled_at
    FROM public.social_posts
   WHERE id = p_post_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déclinaison introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF p_published AND v_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Planifiez une date pour marquer publié' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_posts
     SET publication_status = CASE
           WHEN p_published THEN 'published'
           WHEN scheduled_at IS NULL THEN 'unscheduled'
           ELSE 'scheduled'
         END
   WHERE id = p_post_id
  RETURNING publication_status INTO v_status;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_post_published(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_social_post_published(UUID, BOOLEAN) TO authenticated;

-- ── Édition d'une déclinaison publiée, seule ───────────────────
-- Texte et visuel de cette seule ligne, sans propagation (le trigger ignore une
-- source publiée). Les déclinaisons non publiées passent par
-- save_social_content_group. Un media_id inconnu devient null, comme en 1.3.
CREATE OR REPLACE FUNCTION public.update_social_post_content(
  p_post_id UUID,
  p_text TEXT,
  p_media_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT publication_status INTO v_status
    FROM public.social_posts
   WHERE id = p_post_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Déclinaison introuvable' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'Seule une déclinaison publiée se modifie seule' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_posts
     SET text = COALESCE(p_text, ''),
         media_id = (SELECT m.id FROM public.media m WHERE m.id = p_media_id)
   WHERE id = p_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_social_post_content(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_social_post_content(UUID, TEXT, UUID) TO authenticated;

-- ── Contenu vidé de ses déclinaisons ───────────────────────────
-- Supprimer la dernière déclinaison supprime le groupe. Trigger de contrainte
-- différé à la fin de la transaction : save_social_content_group retire puis
-- réinsère des déclinaisons dans la même transaction, et le groupe ne doit pas
-- disparaître entre les deux. Une cascade depuis le groupe ne fait rien : le
-- groupe n'existe plus quand le trigger s'exécute. Le groupe est verrouillé
-- avant le test, pour qu'un ajout de déclinaison concurrent attende la
-- décision au lieu d'être supprimé avec lui.
CREATE OR REPLACE FUNCTION public.social_posts_delete_empty_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.social_content_groups g WHERE g.id = OLD.group_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  DELETE FROM public.social_content_groups g
   WHERE g.id = OLD.group_id
     AND NOT EXISTS (SELECT 1 FROM public.social_posts sp WHERE sp.group_id = OLD.group_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS social_posts_delete_empty_group ON public.social_posts;
CREATE CONSTRAINT TRIGGER social_posts_delete_empty_group
  AFTER DELETE ON public.social_posts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.social_posts_delete_empty_group();
