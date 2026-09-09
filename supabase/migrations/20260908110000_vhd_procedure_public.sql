-- Lecture publique de la procédure de prévention en vigueur (indicateur 12).
--
-- `vhd_procedures` est en RLS administrateur : le registre et les brouillons ne
-- regardent personne d'autre. Mais la procédure **active** doit être lisible
-- par les apprenants, qui reçoivent le lien de la page de session sans compte.
-- D'où cette fonction SECURITY DEFINER, seule porte ouverte, et volontairement
-- étroite : elle ne rend que la version active, et seulement les champs à
-- publier. Ni les brouillons, ni les versions archivées, ni `created_by`.
--
-- Additive et idempotente : ne crée qu'une fonction, ne touche aucune donnée et
-- ne modifie aucune policy.

CREATE OR REPLACE FUNCTION public.get_active_vhd_procedure()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'version', version,
    'content', content,
    'contact_name', contact_name,
    'contact_email', contact_email,
    'effective_from', effective_from
  )
  FROM public.vhd_procedures
  WHERE status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_vhd_procedure() TO anon, authenticated;

COMMENT ON FUNCTION public.get_active_vhd_procedure() IS
  'Procédure de prévention des violences, harcèlement et discriminations en vigueur, pour affichage sur la page publique de session. Ne rend que la version active.';
