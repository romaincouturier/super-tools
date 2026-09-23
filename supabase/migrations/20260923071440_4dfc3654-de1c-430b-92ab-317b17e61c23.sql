-- Les policies RLS existantes s'appliquent au rôle `public` (donc anon inclus) et
-- appellent ces trois fonctions. Depuis la révocation de 20260915090829, un
-- visiteur non connecté déclenche 42501 « permission denied for function »
-- au lieu d'obtenir simplement false. Les trois fonctions ne renvoient qu'un
-- booléen et restent SECURITY DEFINER : rendre EXECUTE à anon rétablit le
-- comportement « aucune donnée » sans ouvrir de lecture de données.
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO anon;