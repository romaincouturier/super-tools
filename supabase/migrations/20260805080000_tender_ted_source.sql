-- Source TED : les marchés publics européens.
--
-- Tout marché français au-dessus du seuil européen est publié à la fois au
-- BOAMP et au TED. Sur la France, le TED ne fait donc que doublonner, avec un
-- parseur moins éprouvé. Ce que le TED apporte réellement, ce sont les autres
-- pays et les institutions européennes.
--
-- D'où un unique réglage propre à ce connecteur : la liste des pays surveillés.
-- Elle vaut BE,LU par défaut — la Belgique et le Luxembourg, où une prestation
-- de facilitation en français est plausible, et où siègent la plupart des
-- institutions européennes. La France en est volontairement absente.
--
-- Le reste du filtrage (codes CPV, mots-clés, exclusions) est PARTAGÉ avec le
-- BOAMP : un seul filtre, deux sources. Un filtre par source aurait doublé la
-- surface à calibrer pour un volume attendu d'une poignée d'avis par mois.

INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'tender_ted_countries',
  'BE,LU',
  'Codes pays ISO surveillés sur le TED, séparés par des virgules. '
  || 'La France est volontairement absente : ses marchés au-dessus du seuil '
  || 'européen arrivent déjà par le BOAMP, et les ingérer deux fois ne '
  || 'produirait que des doublons. Vider ce réglage désactive la source TED.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Le libellé de source affiché dans la revue. La colonne `source` est du texte
-- libre : rien à contraindre, mais le registre de schéma sert de documentation
-- vivante pour l'agent, il doit dire que la source existe.
UPDATE public.agent_schema_registry
   SET description = replace(
         description,
         'Appels d''offres publics détectés (BOAMP, PLACE, AWS)',
         'Appels d''offres publics détectés (BOAMP, TED, PLACE, AWS)'
       )
 WHERE table_name = 'tender_opportunities'
   AND description LIKE '%(BOAMP, PLACE, AWS)%';
