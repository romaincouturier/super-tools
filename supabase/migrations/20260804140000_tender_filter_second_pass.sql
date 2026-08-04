-- Deuxième passe de calibrage, sur lecture des avis et non sur leurs comptes.
--
-- Après le premier resserrage, l'ingestion sur deux mois retenait encore 141
-- avis pour une cible d'une vingtaine. Les 55 avis portés par les deux
-- derniers critères de volume ont été lus un par un.
--
-- 79822500 « conception graphique », 34 avis : magazine municipal, journal
-- intercommunal, impression et routage, régie publicitaire, stand de salon,
-- identité visuelle. Trente-quatre sur trente-quatre. Pas une facilitation
-- graphique, pas un scribing, pas une restitution visuelle d'atelier. On
-- gardait ce code en pensant qu'un marché du métier serait publié dessous :
-- la lecture dit le contraire, c'est le code des agences de communication.
--
-- « intelligence artificielle », 22 avis : serveur de calcul, casques VR,
-- détection visuelle de tri, surveillance du littoral, développements
-- informatiques. Le terme est devenu si porteur qu'il apparaît dans la prose
-- de n'importe quel marché numérique. Deux avis seulement relevaient du
-- métier, et tous deux nomment l'usage plutôt que la technologie :
-- « prompt engineering » et « intelligence artificielle générative ».
-- Ce sont ces formulations-là qui deviennent les mots-clés.
--
-- Les codes CPV restants n'ont retenu aucun avis sur la période. Ils ne
-- coûtent rien et servent de filet si un acheteur classe correctement.
-- Le repérage repose désormais sur les mots-clés métier, qui donnaient à eux
-- seuls 19 avis sur deux mois, soit exactement le volume attendu.
--
-- Comme la première passe, ces mises à jour ne s'appliquent que si les
-- valeurs n'ont pas été retouchées depuis l'écran de réglages.

UPDATE public.app_settings
   SET setting_value = '80522000,80532000,80533100,80570000,79951000,79311300',
       description =
         'Codes CPV surveillés sur le BOAMP, séparés par des virgules. '
      || 'Les codes de conseil et de formation génériques (80511000, 79411000, '
      || '79419000, 79998000) et la conception graphique (79822500) ont été retirés '
      || 'après lecture des avis : ils faisaient le volume sans amener un seul '
      || 'marché du métier. Le repérage passe par les mots-clés ; ces codes ne sont '
      || 'plus qu''un filet.'
 WHERE setting_key = 'tender_cpv_codes'
   AND setting_value =
       '80511000,80522000,80532000,80533100,80570000,79822500,79951000,79998000,79411000,79419000,79311300';

UPDATE public.app_settings
   SET setting_value =
         'facilitation graphique,facilitation,intelligence collective,sketchnote,'
      || 'scribing,co-construction,codesign,design thinking,conduite du changement,'
      || 'acculturation,intelligence artificielle générative,ia générative,'
      || 'prompt engineering'
 WHERE setting_key = 'tender_keywords'
   AND setting_value =
       'facilitation graphique,facilitation,intelligence collective,sketchnote,scribing,co-construction,codesign,design thinking,conduite du changement,acculturation,intelligence artificielle';
