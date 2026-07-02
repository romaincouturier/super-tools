-- ST-2026-0221 — Impossible de taguer/assigner des utilisateurs.
--
-- La migration sécurité 20260701102838 a restreint la lecture de public.profiles
-- aux seuls admins (pour ne pas exposer is_admin). Effet de bord : les staff
-- non-admin ne voient plus que leur propre profil, donc les sélecteurs
-- d'utilisateurs (mentions Veille, assignations, partages...) sont vides.
--
-- On rétablit un annuaire staff via un RPC SECURITY DEFINER qui n'expose que
-- des colonnes sûres (pas is_admin), accessible à tout utilisateur authentifié.

CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE (user_id uuid, first_name text, last_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, first_name, last_name, email
  FROM public.profiles
  ORDER BY first_name ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_directory() TO authenticated;
