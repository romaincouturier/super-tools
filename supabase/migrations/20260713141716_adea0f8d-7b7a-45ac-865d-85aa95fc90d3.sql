CREATE OR REPLACE FUNCTION public.get_mission_pages_public_deliverables(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'icon', icon,
        'content', content,
        'created_at', created_at
      )
      ORDER BY created_at
    ),
    '[]'::json
  )
  FROM mission_pages
  WHERE mission_id = p_mission_id
    AND is_deliverable = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_pages_public_deliverables(uuid) TO anon, authenticated, service_role;