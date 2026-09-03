GRANT SELECT ON public.formation_configs TO anon;

DROP POLICY IF EXISTS "formation_configs_public_academy" ON public.formation_configs;
CREATE POLICY "formation_configs_public_academy"
ON public.formation_configs
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.lms_courses c
    WHERE c.formation_config_id = formation_configs.id
      AND c.status = 'published'
      AND c.access_type IN ('gratuit', 'payant')
  )
);