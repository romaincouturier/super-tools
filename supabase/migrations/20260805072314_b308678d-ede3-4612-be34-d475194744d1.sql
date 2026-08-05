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

UPDATE public.agent_schema_registry
   SET description = replace(
         description,
         'Appels d''offres publics détectés (BOAMP, PLACE, AWS)',
         'Appels d''offres publics détectés (BOAMP, TED, PLACE, AWS)'
       )
 WHERE table_name = 'tender_opportunities'
   AND description LIKE '%(BOAMP, PLACE, AWS)%';