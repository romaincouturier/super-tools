CREATE OR REPLACE FUNCTION public.practice_posts_force_private_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.visibility_scope IS NULL AND NEW.course_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM lms_courses c WHERE c.id = NEW.course_id AND c.community_is_private) THEN
    NEW.visibility_scope := 'course';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.learner_can_read_theme_post(_course_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.community_theme_mode_on()
    AND _course_id IS NOT NULL
    AND public.get_learner_email() IS NOT NULL
    AND (
      _scope = 'theme'
      OR (_scope IS NULL AND NOT EXISTS (SELECT 1 FROM lms_courses c WHERE c.id = _course_id AND c.community_is_private))
    )
    AND EXISTS (
      SELECT 1 FROM course_community_themes src
      JOIN course_community_themes mine ON mine.theme_id = src.theme_id
      WHERE src.course_id = _course_id
        AND mine.course_id IN (SELECT public.learner_community_course_ids())
    );
$$;

CREATE OR REPLACE FUNCTION public.get_community_spaces()
RETURNS TABLE(space_key text, label text, is_private boolean, course_ids uuid[], publish_course_id uuid, sort_order int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff boolean := public.is_staff_user(); v_mode boolean := public.community_theme_mode_on();
BEGIN
  RETURN QUERY
  WITH mine AS (
    SELECT c.id, c.title, c.community_is_private FROM lms_courses c
    WHERE v_staff OR c.id IN (SELECT public.learner_community_course_ids())
  ), themed AS (
    SELECT t.id, t.name, t.sort_order AS so, array_agg(DISTINCT cct.course_id) AS all_courses
    FROM community_themes t JOIN course_community_themes cct ON cct.theme_id = t.id
    GROUP BY t.id, t.name, t.sort_order
  )
  SELECT 'theme:' || th.id::text, th.name, false, th.all_courses,
         (SELECT m.id FROM mine m WHERE m.id = ANY(th.all_courses) ORDER BY m.community_is_private, m.title LIMIT 1), th.so
  FROM themed th
  WHERE v_mode AND (v_staff OR EXISTS (SELECT 1 FROM mine m WHERE m.id = ANY(th.all_courses)))
  UNION ALL
  SELECT 'course:' || m.id::text, m.title, m.community_is_private, ARRAY[m.id], m.id, 100
  FROM mine m
  WHERE m.community_is_private OR NOT v_mode
     OR NOT EXISTS (SELECT 1 FROM course_community_themes x WHERE x.course_id = m.id);
END $$;