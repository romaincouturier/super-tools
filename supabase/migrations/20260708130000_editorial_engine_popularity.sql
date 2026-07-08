-- Moteur éditorial : prise en compte de la popularité des articles.
--
-- Main a ajouté wp_articles.popularity ('forte'|'moyenne'|'faible') et
-- wp_articles.internal_note, plus les vues réelles. Le moteur les remonte
-- désormais dans la similarité et le contexte de performance.

-- Le type de retour change : DROP puis recréation (CREATE OR REPLACE ne
-- peut pas modifier les colonnes OUT).
DROP FUNCTION IF EXISTS public.match_wp_articles(extensions.vector, int);

CREATE FUNCTION public.match_wp_articles(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, title text, url text, published_at timestamptz, modified_at timestamptz,
  views integer, popularity text, internal_note text, similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.title, a.url, a.published_at, a.modified_at, a.views,
         a.popularity, a.internal_note,
         1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.wp_articles a
  WHERE a.embedding IS NOT NULL
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_wp_articles(extensions.vector, int) TO authenticated;

-- Règle de décision supplémentaire dans le référentiel (idempotent : ne
-- touche pas un prompt déjà enrichi ou déjà personnalisé sur ce point).
UPDATE public.transcript_ai_prompts
SET system_prompt = system_prompt || '

POPULARITÉ ÉDITORIALE DES ARTICLES :
Chaque article existant peut porter une note de popularité manuelle (forte/moyenne/faible) et une note interne de l''équipe.
- Popularité FORTE sur un article proche = preuve d''audience sur le sujet : privilégier ameliorer_article ou recycler cet article, et rehausser score_seo et score_besoin.
- Popularité FAIBLE sur un sujet très proche = l''angle actuel ne prend pas : ne recommander un nouveau contenu que si l''angle est réellement différent, sinon ne_rien_faire.
- Toujours tenir compte des notes internes fournies avec les articles proches.'
WHERE kind = 'editorial_engine'
  AND system_prompt NOT LIKE '%POPULARITÉ ÉDITORIALE%';
