-- Le TED se repère sur les mots-clés seuls : les codes CPV de formation
-- partagés avec le BOAMP inondent à l'échelle de l'Europe (mesuré le 05/08/2026,
-- 248 avis pour une poignée attendue). D'où une liste CPV propre au TED, vide.
-- ON CONFLICT DO NOTHING et non DO UPDATE : une valeur ajustée à la main depuis
-- l'écran de réglages ne doit pas être écrasée au rejeu (règle [046]).
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES (
  'tender_ted_cpv_codes',
  '',
  'Codes CPV surveilles sur le TED. Vide = aucun : la prospection europeenne se fait sur les mots-cles seuls.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Pas de reset de tender_ted_countries ici : la migration 20260805080000 l'a
-- déjà posé à vide, et un UPDATE inconditionnel écraserait un réglage manuel.

-- Le filtre de langue est inerte (le TED traduit chaque avis dans les 24
-- langues officielles) : le réglage est supprimé, la fonction retirée du code.
DELETE FROM public.app_settings WHERE setting_key = 'tender_ted_languages';