-- ST-2026-0214 — Impossible de supprimer / mettre à la corbeille un transcript.
--
-- La table public.transcripts avait la RLS activée avec UNIQUEMENT une policy
-- SELECT. Toute mise à jour (mise à la corbeille = UPDATE status='trashed') ou
-- suppression initiée par un utilisateur authentifié était donc bloquée par la
-- RLS : 0 ligne affectée, aucune erreur renvoyée -> "il ne se passe rien".
-- Les imports fonctionnent car ils passent par le service_role (bypass RLS).
--
-- Module staff-only : on autorise UPDATE et DELETE aux utilisateurs authentifiés
-- (même modèle que watch_items).

CREATE POLICY "Authenticated users can update transcripts"
  ON public.transcripts FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete transcripts"
  ON public.transcripts FOR DELETE TO authenticated
  USING (true);
