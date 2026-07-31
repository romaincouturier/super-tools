ALTER TABLE public.mission_contacts ADD COLUMN IF NOT EXISTS is_sponsor boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_mission_contact_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id,
    'mission_id', mission_id,
    'first_name', first_name,
    'last_name', last_name,
    'email', email,
    'is_sponsor', is_sponsor
  )
  FROM mission_contacts
  WHERE access_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_contact_by_token(text) TO anon, authenticated, service_role;