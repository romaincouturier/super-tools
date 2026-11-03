CREATE OR REPLACE FUNCTION public.get_daily_actions_per_user(p_weeks int DEFAULT 12)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  week_start date,
  total_actions bigint,
  completed_actions bigint
)
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
  SELECT
    d.user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      p.display_name,
      p.email,
      d.user_id::text
    ) AS display_name,
    date_trunc('week', d.action_date)::date AS week_start,
    COUNT(*) AS total_actions,
    COUNT(*) FILTER (WHERE d.is_completed) AS completed_actions
  FROM public.daily_actions d
  LEFT JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.action_date >= date_trunc('week', CURRENT_DATE) - (GREATEST(p_weeks, 1) - 1) * INTERVAL '1 week'
  GROUP BY d.user_id, p.first_name, p.last_name, p.display_name, p.email, week_start
  ORDER BY week_start, display_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_actions_per_user(int) TO authenticated;