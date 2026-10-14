CREATE OR REPLACE FUNCTION public.get_lms_upcoming_sessions(_catalog_ids uuid[], _max_items integer DEFAULT 4)
RETURNS TABLE (session_id uuid, start_date date, end_date date, day_dates date[], city text, is_full boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.start_date, t.end_date,
    (SELECT array_agg(DISTINCT s.day_date ORDER BY s.day_date) FROM training_schedules s WHERE s.training_id = t.id),
    COALESCE(NULLIF(trim(v.city), ''), NULLIF(trim(t.location), '')),
    (t.max_participants IS NOT NULL AND t.max_participants > 0 AND
      (SELECT count(*) FROM training_participants p WHERE p.training_id = t.id AND p.repositioned_to_training_id IS NULL) >= t.max_participants)
  FROM trainings t
  LEFT JOIN training_venues v ON v.id = t.venue_id
  WHERE t.catalog_id = ANY(_catalog_ids)
    AND t.session_type = 'inter'
    AND COALESCE(t.is_cancelled, false) = false
    AND t.start_date >= (now() AT TIME ZONE 'Europe/Paris')::date
  ORDER BY t.start_date
  LIMIT LEAST(GREATEST(COALESCE(_max_items, 4), 1), 20);
$$;
REVOKE EXECUTE ON FUNCTION public.get_lms_upcoming_sessions(uuid[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lms_upcoming_sessions(uuid[], integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_lms_catalog_page_url(_catalog_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT programme_url FROM formation_configs WHERE id = _catalog_id $$;
REVOKE EXECUTE ON FUNCTION public.get_lms_catalog_page_url(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lms_catalog_page_url(uuid) TO anon, authenticated, service_role;