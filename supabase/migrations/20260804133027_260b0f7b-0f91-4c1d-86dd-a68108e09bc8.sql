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

UPDATE public.app_settings
   SET setting_value = setting_value
      || ',vidéoprotection,vidéosurveillance,logiciel,progiciel,infogérance,'
      || 'téléphonie,mobilier,imprimerie,signalétique,restauration scolaire'
 WHERE setting_key = 'tender_exclusions'
   AND setting_value NOT LIKE '%vidéoprotection%';