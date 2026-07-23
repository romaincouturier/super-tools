ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS share_activities_with_client boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_mission_public_summary(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id,
    'title', title,
    'description', description,
    'client_name', client_name,
    'status', status,
    'start_date', start_date,
    'end_date', end_date,
    'initial_amount', initial_amount,
    'daily_rate', daily_rate,
    'total_days', total_days,
    'emoji', emoji,
    'location', location,
    'share_activities_with_client', share_activities_with_client
  )
  FROM public.missions WHERE id = p_mission_id;
$$;