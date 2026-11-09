-- Accusé de réception des réclamations (indicateur 31).
--
-- Le référentiel V10 attend, comme première preuve du traitement des
-- réclamations, l'accusé de réception adressé au réclamant. Jusqu'ici rien
-- n'était envoyé à la soumission du formulaire public : le registre prouvait
-- le traitement, pas la prise en compte.
--
-- Cette colonne porte la trace de l'envoi. Elle est nullable : les
-- réclamations déjà enregistrées restent telles quelles, sans accusé
-- rétroactif, ce qui serait faux.
--
-- Additive et idempotente. Aucune donnée existante n'est modifiée.

ALTER TABLE public.reclamations
  ADD COLUMN IF NOT EXISTS acknowledgement_sent_at timestamptz;

COMMENT ON COLUMN public.reclamations.acknowledgement_sent_at IS
  'Date d''envoi de l''accusé de réception au réclamant (indicateur 31). NULL tant qu''aucun accusé n''a été envoyé.';
