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