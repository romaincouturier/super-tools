-- ST-2026-0199 — Permettre l'ajout de commentaires sur les contenus de veille
-- Champ libre saisi par l'utilisateur pour contextualiser un contenu (ex: ce qu'il
-- a trouvé pertinent dans un article). Distinct de `body` qui peut être écrasé par
-- le scraping automatique des URLs.
ALTER TABLE public.watch_items
  ADD COLUMN IF NOT EXISTS comment text NOT NULL DEFAULT '';
