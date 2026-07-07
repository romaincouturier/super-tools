-- ST-2026-0227 — L'import CSV WordPress échouait systématiquement.
-- Les index uniques partiels (WHERE ... IS NOT NULL) ne peuvent pas être
-- inférés par ON CONFLICT (col) sans clause de prédicat, que PostgREST
-- (upsert onConflict) n'émet jamais → erreur 42P10 au premier lot.
-- Les prédicats étaient inutiles : un index unique complet accepte déjà
-- plusieurs NULL (NULLS DISTINCT par défaut).

DROP INDEX IF EXISTS public.wp_articles_wp_id_key;
DROP INDEX IF EXISTS public.wp_articles_url_key;

-- Dédoublonnage défensif avant pose des index (garde la ligne la plus récente).
DELETE FROM public.wp_articles a
USING public.wp_articles b
WHERE a.wp_id IS NOT NULL AND a.wp_id = b.wp_id
  AND (a.imported_at, a.id) < (b.imported_at, b.id);

DELETE FROM public.wp_articles a
USING public.wp_articles b
WHERE a.url IS NOT NULL AND a.url = b.url
  AND (a.imported_at, a.id) < (b.imported_at, b.id);

CREATE UNIQUE INDEX wp_articles_wp_id_key ON public.wp_articles (wp_id);
CREATE UNIQUE INDEX wp_articles_url_key ON public.wp_articles (url);
