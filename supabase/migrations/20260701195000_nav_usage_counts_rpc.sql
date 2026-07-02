-- Tri de la sidebar par popularité : agrégat GLOBAL (tous utilisateurs) des
-- pages vues par segment de chemin, sur 90 jours glissants.
-- SECURITY DEFINER car la RLS de feature_usage ne permet de lire que ses
-- propres événements ; on n'expose ici que des totaux anonymes.

CREATE OR REPLACE FUNCTION public.get_nav_usage_counts()
RETURNS TABLE (segment text, clicks bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT split_part(COALESCE(metadata->>'path', ''), '/', 2) AS segment,
         count(*)::bigint AS clicks
  FROM public.feature_usage
  WHERE feature_name = 'page_view'
    AND created_at > now() - interval '90 days'
    AND COALESCE(metadata->>'path', '') <> ''
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_nav_usage_counts() TO authenticated;
