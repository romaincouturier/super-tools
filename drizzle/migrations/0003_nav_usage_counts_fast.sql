CREATE INDEX IF NOT EXISTS idx_feature_usage_page_view_created
  ON public.feature_usage (created_at DESC)
  WHERE feature_name = 'page_view';

CREATE OR REPLACE FUNCTION public.get_nav_usage_counts()
RETURNS TABLE(segment text, clicks bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Contrôle d'accès évalué une seule fois (et non pour chaque ligne).
  IF NOT public.is_staff_user() THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT split_part(fu.metadata->>'path', '/', 2) AS segment, count(*)::bigint AS clicks
      FROM public.feature_usage fu
     WHERE fu.feature_name = 'page_view'
       AND fu.created_at > now() - interval '90 days'
       AND COALESCE(fu.metadata->>'path', '') <> ''
     GROUP BY 1;
END $$;