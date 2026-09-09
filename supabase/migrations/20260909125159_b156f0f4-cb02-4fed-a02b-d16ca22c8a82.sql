-- 20260908110000_vhd_procedure_public.sql
CREATE OR REPLACE FUNCTION public.get_active_vhd_procedure()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'version', version,
    'content', content,
    'contact_name', contact_name,
    'contact_email', contact_email,
    'effective_from', effective_from
  )
  FROM public.vhd_procedures
  WHERE status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_vhd_procedure() TO anon, authenticated;

COMMENT ON FUNCTION public.get_active_vhd_procedure() IS
  'Procédure de prévention des violences, harcèlement et discriminations en vigueur, pour affichage sur la page publique de session. Ne rend que la version active.';