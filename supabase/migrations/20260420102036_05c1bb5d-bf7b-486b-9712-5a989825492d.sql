-- Supprimer les pièces jointes fantômes (références en BDD sans fichier physique dans le storage)
-- Toutes étaient affectées par le bug d'encodage des caractères spéciaux dans les noms de fichiers
DELETE FROM public.crm_attachments
WHERE id IN (
  'ba5d8b8b-b2c2-4be2-9155-337bebfa266f', -- NDA Supertilt_signé.pdf (EDF)
  '927afb67-b031-47ef-9208-a96847e74a62', -- Synthèse du besoin.pdf (Solvay)
  '66fefff7-cb57-480f-a766-a00d7e53d88f', -- programme_formation Appropriation avancée... (Formation IA)
  'b4bad485-5eb8-4d4f-b93e-7c9004f96de7'  -- AI4Coaching IA avancée... (Formation IA)
);