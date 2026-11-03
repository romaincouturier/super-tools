CREATE POLICY "learners_read_published_course_formulas" ON public.formation_formulas
FOR SELECT TO authenticated
USING (
  woocommerce_product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.lms_courses c
    WHERE c.formation_config_id = formation_formulas.formation_config_id
      AND c.status = 'published'
      AND c.access_type IN ('gratuit','payant')
  )
);