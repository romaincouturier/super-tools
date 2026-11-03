-- Formations recommandées (portail apprenant) : sessions inter à venir, tous
-- catalogues confondus. SECURITY DEFINER en lecture seule : un apprenant n'a
-- pas d'accès RLS à `trainings`. Ne renvoie que des faits de session et de
-- catalogue (dates, ville, complet, nom et lien de la fiche), jamais de donnée
-- participant (même périmètre que get_lms_upcoming_sessions).
-- Droits : connectés et service_role, pas anon.

CREATE OR REPLACE FUNCTION public.get_recommended_inter_sessions(_max_items integer DEFAULT 40)
RETURNS TABLE (
  session_id uuid,
  catalog_id uuid,
  formation_name text,
  supertilt_link text,
  prix numeric,
  start_date date,
  end_date date,
  day_dates date[],
  city text,
  is_full boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.catalog_id, c.formation_name, c.supertilt_link, c.prix,
    t.start_date, t.end_date,
    (SELECT array_agg(DISTINCT s.day_date ORDER BY s.day_date) FROM training_schedules s WHERE s.training_id = t.id),
    COALESCE(NULLIF(trim(v.city), ''), NULLIF(trim(t.location), '')),
    (t.max_participants IS NOT NULL AND t.max_participants > 0 AND
      (SELECT count(*) FROM training_participants p WHERE p.training_id = t.id AND p.repositioned_to_training_id IS NULL) >= t.max_participants)
  FROM trainings t
  JOIN formation_configs c ON c.id = t.catalog_id
  LEFT JOIN training_venues v ON v.id = t.venue_id
  WHERE auth.uid() IS NOT NULL
    AND t.session_type = 'inter'
    AND COALESCE(t.is_cancelled, false) = false
    AND t.start_date >= (now() AT TIME ZONE 'Europe/Paris')::date
  ORDER BY t.start_date
  LIMIT LEAST(GREATEST(COALESCE(_max_items, 40), 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.get_recommended_inter_sessions(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recommended_inter_sessions(integer) TO authenticated, service_role;
