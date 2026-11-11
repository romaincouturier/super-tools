CREATE OR REPLACE FUNCTION public.get_project_assignees()
RETURNS TABLE(user_id uuid, display_name text, first_name text, last_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.first_name, p.last_name, p.email
  FROM public.profiles p
  WHERE public.is_staff_user()
    AND (p.is_admin OR EXISTS (SELECT 1 FROM public.user_module_access m WHERE m.user_id=p.user_id))
  ORDER BY p.first_name NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.get_project_assignees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_assignees() TO authenticated, service_role;