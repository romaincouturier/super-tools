-- 20260908120000_vhd_narrative_access_log.sql
CREATE TABLE IF NOT EXISTS public.vhd_narrative_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vhd_reports(id) ON DELETE CASCADE,
  user_id uuid,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhd_narrative_access_report
  ON public.vhd_narrative_access(report_id, accessed_at DESC);

GRANT SELECT ON public.vhd_narrative_access TO authenticated;
GRANT ALL ON public.vhd_narrative_access TO service_role;

ALTER TABLE public.vhd_narrative_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vhd_narrative_access_read ON public.vhd_narrative_access;
CREATE POLICY vhd_narrative_access_read ON public.vhd_narrative_access
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.read_vhd_narrative(p_report_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_narrative text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT narrative INTO v_narrative
  FROM public.vhd_report_narratives
  WHERE report_id = p_report_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.vhd_narrative_access (report_id, user_id)
  VALUES (p_report_id, auth.uid());

  RETURN v_narrative;
END;
$$;

REVOKE ALL ON FUNCTION public.read_vhd_narrative(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.read_vhd_narrative(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vhd_narrative_access(p_report_id uuid)
RETURNS TABLE (accessed_at timestamptz, user_id uuid, reader text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT a.accessed_at,
         a.user_id,
         COALESCE(
           NULLIF(TRIM(p.display_name), ''),
           NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
           p.email,
           ''
         )::text
  FROM public.vhd_narrative_access a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.report_id = p_report_id
  ORDER BY a.accessed_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vhd_narrative_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_vhd_narrative_access(uuid) TO authenticated;

COMMENT ON TABLE public.vhd_narrative_access IS
  'Journal des consultations du récit d''un signalement. Écrit uniquement par read_vhd_narrative ; en lecture seule pour les administrateurs.';

DROP POLICY IF EXISTS vhd_report_narratives_admin ON public.vhd_report_narratives;

DROP POLICY IF EXISTS vhd_report_narratives_insert ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_insert ON public.vhd_report_narratives
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_report_narratives_update ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_update ON public.vhd_report_narratives
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_report_narratives_delete ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_delete ON public.vhd_report_narratives
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));