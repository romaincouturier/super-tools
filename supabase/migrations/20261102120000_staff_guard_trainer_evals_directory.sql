-- Red team : deux RPC SECURITY DEFINER exécutables par tout compte connecté,
-- sans contrôle de droit. L'inscription est ouverte : un apprenant a une
-- session et lisait les retours d'évaluation de n'importe quel formateur et
-- l'annuaire du staff (emails).
--
-- Complète 20260924190000_staff_guard_internal_rpcs.sql (get_cron_status,
-- learner_accounts_for_emails, get_db_size, get_nav_usage_counts), même garde :
-- public.is_staff_user() (admin ou accès à un module), en tête de corps.
-- Corps repris à l'identique de leur dernière définition :
--   get_previous_trainer_evaluations  20260308202024_2d60e8f7-...
--   get_staff_directory               20260701192000_staff_directory_rpc
-- Droits d'exécution (authenticated, service_role, pas anon) inchangés
-- (20260915090829).

CREATE OR REPLACE FUNCTION public.get_previous_trainer_evaluations(p_trainer_email text, p_exclude_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(json_build_object('points_forts', points_forts, 'axes_amelioration', axes_amelioration, 'commentaires', commentaires)), '[]'::json)
    FROM trainer_evaluations
    WHERE trainer_email = p_trainer_email AND status = 'soumis' AND id != p_exclude_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_directory()
RETURNS TABLE (user_id uuid, first_name text, last_name text, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff_user() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.last_name, p.email, p.display_name
  FROM public.profiles p
  ORDER BY p.first_name ASC NULLS LAST;
END;
$$;
