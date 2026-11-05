-- Contenus sociaux : poser ou déplacer la date d'un groupe en une seule
-- instruction. Seules les déclinaisons non publiées changent ; elles passent
-- en « programmé », ou en « sans date » si la date est retirée.
-- SECURITY INVOKER : la RLS de l'appelant s'applique. Un groupe invisible pour
-- l'appelant est refusé plutôt qu'ignoré en silence.
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

  UPDATE public.social_posts
     SET scheduled_at = p_scheduled_at,
         publication_status = CASE WHEN p_scheduled_at IS NULL THEN 'unscheduled' ELSE 'scheduled' END
   WHERE group_id = p_group_id
     AND publication_status <> 'published';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_group_date(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_social_group_date(UUID, TIMESTAMPTZ) TO authenticated;
