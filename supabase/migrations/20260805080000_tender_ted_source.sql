-- Source TED : les marchés publics européens.
--
-- Tout marché français au-dessus du seuil européen est publié à la fois au
-- BOAMP et au TED. Le rapprochement inter-sources (`link_tender_duplicates`)
-- s'occupe de ces doublons : ce n'est pas une raison pour exclure un pays.
--
-- Deux réglages propres à ce connecteur, et le critère qui commande est la
-- LANGUE, pas la géographie. Un marché est prospectable dès lors qu'il se lit
-- et se répond en français ou en anglais, où qu'il soit publié.
--
--   tender_ted_countries : VIDE par défaut, c'est-à-dire tous les pays.
--       Ne sert qu'à resserrer si le volume devient ingérable.
--   tender_ted_languages : les langues dans lesquelles on sait répondre.
--       Un avis publié uniquement en allemand ou en néerlandais est écarté :
--       il n'est ni lisible ni répondable, l'afficher ne ferait qu'encombrer
--       la revue.
--
-- Le reste du filtrage (codes CPV, mots-clés, exclusions) est PARTAGÉ avec le
-- BOAMP : un seul filtre, deux sources.

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  (
    'tender_ted_countries',
    '',
    'Codes pays ISO surveillés sur le TED, séparés par des virgules. '
    || 'VIDE = tous les pays, ce qui est le réglage par défaut : le critère de '
    || 'prospection est la langue de l''avis, pas sa géographie. À ne resserrer '
    || 'que si le volume devient ingérable.'
  ),
  (
    'tender_ted_languages',
    'fra,eng',
    'Langues dans lesquelles un avis est exploitable, séparées par des virgules '
    || '(codes ISO 639-2 du TED : fra, eng, deu, nld…). Un avis qui n''existe '
    || 'dans aucune de ces langues est écarté : il n''est ni lisible ni '
    || 'répondable. Vider ce réglage accepte toutes les langues.'
  )
ON CONFLICT (setting_key) DO NOTHING;

-- Les mots-clés métier en anglais, pour que la prospection hors de France ne
-- dépende pas du seul code CPV. Ajoutés à la liste partagée : ils ne créent
-- pas de faux positifs sur le BOAMP, aucun avis français ne parlant de
-- « change management » ou de « collective intelligence ».
-- Conditionné à la valeur en place (règle [046]) : un réglage ajusté à la main
-- depuis l'écran de paramètres ne doit pas être écrasé.
UPDATE public.app_settings
   SET setting_value = setting_value
      || ',graphic facilitation,graphic recording,visual facilitation,'
      || 'collective intelligence,change management,workshop facilitation,'
      || 'co-design,ai literacy,generative artificial intelligence',
       description = description
      || ' Les termes anglais servent la prospection européenne : le critère '
      || 'est la langue de l''avis, pas le pays.'
 WHERE setting_key = 'tender_keywords'
   AND setting_value NOT LIKE '%graphic facilitation%';

-- Le registre de schéma sert de documentation vivante pour l'agent : il doit
-- dire que la source existe.
UPDATE public.agent_schema_registry
   SET description = replace(
         description,
         'Appels d''offres publics détectés (BOAMP, PLACE, AWS)',
         'Appels d''offres publics détectés (BOAMP, TED, PLACE, AWS)'
       )
 WHERE table_name = 'tender_opportunities'
   AND description LIKE '%(BOAMP, PLACE, AWS)%';
