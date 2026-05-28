-- Stocke l'URL de la branche GitHub / PR générée par le skill /process-ticket.
-- Affichée comme lien cliquable dans la carte kanban (colonne vibe_coding).

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS branch_url text;
