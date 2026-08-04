-- Calibrage du filtre sur la première ingestion réelle.
--
-- Mesure du 03/08/2026, 278 avis retenus sur deux mois, répartition par
-- critère de retenue :
--   80530000 Formation professionnelle .......... 69
--   79822500 Conception graphique ............... 42
--   79952000 Organisation d'événements .......... 33
--   80511000 Formation du personnel ............. 28
--   80500000 Formation (chapeau) ................ 26
--   80510000 Formation spécialisée (chapeau) .... 15
--   80000000 Enseignement (chapeau) ............. 8
--   79400000 Conseil en affaires (chapeau) ...... 6
--   « facilitation » ............................ 1
--   « intelligence collective » ................. 0
--   « sketchnote », « scribing », « codesign »... 0
--
-- Deux enseignements :
--   1. Les chapeaux et les catégories les plus larges font tout le volume,
--      pour des marchés qui ne sont pas du métier. Ils partent.
--   2. Les mots-clés métier ne ramenaient rien parce qu'ils n'étaient
--      cherchés que dans le TITRE. Corrigé dans le connecteur, qui interroge
--      désormais le texte complet de l'avis.
--
-- Les valeurs restent modifiables depuis l'écran de réglages : cette
-- migration ne s'applique que si elles n'ont pas déjà été ajustées à la main.

UPDATE public.app_settings
   SET setting_value =
         '80511000,80522000,80532000,80533100,80570000,'
      || '79822500,79951000,79998000,79411000,79419000,79311300',
       description =
         'Codes CPV surveillés sur le BOAMP, séparés par des virgules. '
      || 'Les chapitres génériques (80000000, 80500000, 80510000, 79400000) et les '
      || 'catégories les plus larges (80530000 formation professionnelle, 79952000 '
      || 'organisation d''événements) ont été retirés après mesure : ils faisaient '
      || 'l''essentiel du volume sans amener de marché du métier.'
 WHERE setting_key = 'tender_cpv_codes'
   AND setting_value =
       '80000000,80500000,80510000,80511000,80522000,80532000,80533100,80530000,80570000,79400000,79411000,79419000,79822500,79951000,79952000,79998000,79311300';

UPDATE public.app_settings
   SET description =
         'Mots-clés cherchés dans le TEXTE COMPLET des avis BOAMP (titre, descripteurs, '
      || 'objet complet, intitulés de lots et critères), séparés par des virgules. '
      || 'Cherchés dans le seul titre jusqu''au 03/08/2026, ils ne ramenaient rien.'
 WHERE setting_key = 'tender_keywords';

-- Exclusions enrichies des faux positifs constatés sur la première revue.
UPDATE public.app_settings
   SET setting_value = setting_value
      || ',vidéoprotection,vidéosurveillance,logiciel,progiciel,infogérance,'
      || 'téléphonie,mobilier,imprimerie,signalétique,restauration scolaire'
 WHERE setting_key = 'tender_exclusions'
   AND setting_value NOT LIKE '%vidéoprotection%';
