-- Calibrage du TED sur la première ingestion réelle.
--
-- Mesure du 05/08/2026 sur 248 avis retenus en deux mois, répartition par
-- critère de retenue :
--   79951000 organisation de séminaires ........ 73
--   80570000 formation développement personnel . 49
--   80533100 initiation informatique ........... 44
--   79311300 analyse d'enquêtes ................ 37
--   80522000 séminaires de formation ........... 33
--   80532000 formation à la gestion ............ 26
--   « facilitation » .......................... 3
--   « change management » ..................... 2
--   « acculturation » ......................... 1
--
-- Deux enseignements, tous deux vérifiés sur les avis bruts :
--
--   1. Le volume vient ENTIÈREMENT des codes CPV, jamais des mots-clés. Ces
--      codes de formation générique tiennent à l'échelle de la France (le
--      BOAMP en tirait 19) mais inondent à l'échelle de l'Europe. Ils ne sont
--      donc pas surveillés sur le TED : la source se repère sur les mots-clés
--      métier, en français et en anglais. Le BOAMP, lui, garde ces codes — sa
--      liste n'est pas touchée, c'est tout l'intérêt d'une liste par source.
--
--   2. Le filtre de langue est inerte. Le TED traduit chaque avis dans les 24
--      langues officielles, donc « existe en fra ou eng » est toujours vrai. Et
--      le repointer sur la langue d'origine (`links.pdfs`) écarterait un avis
--      polonais parfaitement lisible dans sa traduction anglaise. Le réglage est
--      supprimé, la fonction retirée du code.

-- CPV propres au TED, vides : la source se repère sur les mots-clés. Ajouter un
-- code ici le surveillerait sur le TED sans toucher au BOAMP.
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'tender_ted_cpv_codes',
  '',
  'Codes CPV surveillés SUR LE TED uniquement, séparés par des virgules. '
  || 'VIDE par défaut : à l''échelle de l''Europe, les codes de formation '
  || 'générique inondent, donc le TED se repère sur les mots-clés métier. '
  || 'Le BOAMP garde sa propre liste (tender_cpv_codes), inchangée.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Le filtre de langue est retiré : inerte, le TED traduisant tout en 24 langues.
DELETE FROM public.app_settings WHERE setting_key = 'tender_ted_languages';
