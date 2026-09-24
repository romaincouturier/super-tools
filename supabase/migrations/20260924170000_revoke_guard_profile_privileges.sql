-- guard_profile_privileges() est une fonction de trigger SECURITY DEFINER.
-- Postgres ne vérifie pas le droit EXECUTE quand il déclenche un trigger : le
-- garde-fou sur profiles reste actif. Retirer ce droit supprime seulement
-- l'exposition à anon et authenticated signalée par le contrôle de sécurité.
REVOKE EXECUTE ON FUNCTION public.guard_profile_privileges() FROM PUBLIC, anon, authenticated;
