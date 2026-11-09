CREATE TABLE public.community_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_themes TO authenticated;
GRANT ALL ON public.community_themes TO service_role;
ALTER TABLE public.community_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read themes" ON public.community_themes FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage themes" ON public.community_themes FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE TABLE public.course_community_themes (
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  theme_id uuid NOT NULL REFERENCES public.community_themes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, theme_id)
);
GRANT SELECT, INSERT, DELETE ON public.course_community_themes TO authenticated;
GRANT ALL ON public.course_community_themes TO service_role;
ALTER TABLE public.course_community_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read course themes" ON public.course_community_themes FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage course themes" ON public.course_community_themes FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

ALTER TABLE public.lms_courses ADD COLUMN IF NOT EXISTS community_is_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.practice_posts ADD COLUMN IF NOT EXISTS visibility_scope text CHECK (visibility_scope IN ('theme','course'));

INSERT INTO public.community_themes (slug, name, sort_order) VALUES
 ('facilitation-graphique','Facilitation graphique',1),
 ('intelligence-collective','Intelligence collective',2),
 ('ia','IA',3),
 ('transformation','Transformation',4)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.lms_courses SET community_is_private = true WHERE id IN (
 '50c0c209-e6ad-4035-8233-6acf0f06be16','70567c1c-a3d0-4581-ab77-c35082fa9c90',
 'c67f8375-ca71-4419-b2ea-e3655ca6f71a','5c6e0df1-8a63-4e15-aa7a-9bfb645fb626',
 '8a8481ce-506d-49d6-ad93-68c0f87e8522');

INSERT INTO public.course_community_themes (course_id, theme_id)
SELECT v.cid::uuid, t.id FROM (VALUES
 ('a1958c5d-17cb-4ede-8823-728e6c874cfc','facilitation-graphique'),
 ('4385a185-48d2-4caf-9d5d-1b6f955ac854','facilitation-graphique'),
 ('c3801b50-f819-4b58-b51c-383075abd40d','facilitation-graphique'),
 ('e08c7087-3635-4e83-a86b-b288ea41edb8','facilitation-graphique'),
 ('06490425-823f-4784-b077-8848b900bac5','facilitation-graphique'),
 ('52dd94ca-937b-43fe-8f61-303a85349a67','facilitation-graphique'),
 ('50c0c209-e6ad-4035-8233-6acf0f06be16','facilitation-graphique'),
 ('70567c1c-a3d0-4581-ab77-c35082fa9c90','facilitation-graphique'),
 ('c67f8375-ca71-4419-b2ea-e3655ca6f71a','facilitation-graphique'),
 ('5c6e0df1-8a63-4e15-aa7a-9bfb645fb626','facilitation-graphique'),
 ('8a8481ce-506d-49d6-ad93-68c0f87e8522','facilitation-graphique'),
 ('1a8efa6c-fddc-4e4c-9228-e67aff4083b0','intelligence-collective'),
 ('f794d041-0794-4ced-b2e2-cd3fb7ac8287','intelligence-collective'),
 ('826c2e2c-884d-461d-be61-3bd66ae34440','intelligence-collective'),
 ('65592ca7-4cbb-43f1-b9f3-cc2a3134742e','intelligence-collective'),
 ('523576df-b909-4b02-8ccc-dfc0626b812c','ia'),
 ('94cc8cc8-621c-453e-b660-6271ed83b25b','ia'),
 ('1ce4774b-890e-4cb0-8a8d-5dfbb3d12d39','ia'),
 ('d20bf41f-6eeb-47b7-aab7-57def92d69ca','transformation'),
 ('2da412a9-4917-4306-9187-a2137b17700c','transformation'),
 ('98f7aa46-a2e9-40af-a408-d680d5f4b995','transformation')
) AS v(cid, slug) JOIN public.community_themes t ON t.slug = v.slug
WHERE EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = v.cid::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value)
SELECT 'community_theme_mode', 'true'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE setting_key = 'community_theme_mode');

CREATE OR REPLACE FUNCTION public.community_theme_mode_on()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT setting_value::text FROM app_settings WHERE setting_key = 'community_theme_mode' LIMIT 1), 'true') NOT IN ('false', '"false"');
$$;

CREATE OR REPLACE FUNCTION public.practice_posts_force_private_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM lms_courses c WHERE c.id = NEW.course_id AND c.community_is_private) THEN
    NEW.visibility_scope := 'course';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_practice_posts_force_private_scope BEFORE INSERT OR UPDATE OF course_id, visibility_scope ON public.practice_posts
FOR EACH ROW EXECUTE FUNCTION public.practice_posts_force_private_scope();
UPDATE public.practice_posts p SET visibility_scope = 'course'
WHERE EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = p.course_id AND c.community_is_private);

CREATE OR REPLACE FUNCTION public.learner_community_course_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.course_id FROM lms_enrollments e WHERE lower(e.learner_email) = public.get_learner_email()
  UNION
  SELECT t.supports_lms_course_id FROM training_participants tp JOIN trainings t ON t.id = tp.training_id
  WHERE t.supports_lms_course_id IS NOT NULL AND lower(tp.email) = public.get_learner_email();
$$;

CREATE OR REPLACE FUNCTION public.learner_can_read_theme_post(_course_id uuid, _scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.community_theme_mode_on()
    AND _course_id IS NOT NULL
    AND COALESCE(_scope, 'theme') = 'theme'
    AND public.get_learner_email() IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM lms_courses c WHERE c.id = _course_id AND c.community_is_private)
    AND EXISTS (
      SELECT 1 FROM course_community_themes src
      JOIN course_community_themes mine ON mine.theme_id = src.theme_id
      WHERE src.course_id = _course_id
        AND mine.course_id IN (SELECT public.learner_community_course_ids())
    );
$$;

CREATE OR REPLACE FUNCTION public.learner_can_read_practice_post(_post_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM practice_posts p WHERE p.id = _post_id
    AND (lower(p.author_email) = public.get_learner_email()
         OR public.learner_can_read_community(p.course_id)
         OR public.learner_can_read_theme_post(p.course_id, p.visibility_scope)));
$$;

DROP POLICY IF EXISTS auth_learner_read_practice_posts ON public.practice_posts;
CREATE POLICY auth_learner_read_practice_posts ON public.practice_posts FOR SELECT TO authenticated
USING (lower(author_email) = public.get_learner_email()
  OR public.learner_can_read_community(course_id)
  OR public.learner_can_read_theme_post(course_id, visibility_scope));

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
    JOIN lms_courses c ON c.id = cct.course_id AND NOT c.community_is_private
    GROUP BY t.id, t.name, t.sort_order
  )
  SELECT 'theme:' || th.id::text, th.name, false, th.all_courses,
         (SELECT m.id FROM mine m WHERE m.id = ANY(th.all_courses) ORDER BY m.title LIMIT 1), th.so
  FROM themed th
  WHERE v_mode AND (v_staff OR EXISTS (SELECT 1 FROM mine m WHERE m.id = ANY(th.all_courses)))
  UNION ALL
  SELECT 'course:' || m.id::text, m.title, m.community_is_private, ARRAY[m.id], m.id, 100
  FROM mine m
  WHERE m.community_is_private OR NOT v_mode
     OR NOT EXISTS (SELECT 1 FROM course_community_themes x WHERE x.course_id = m.id);
END $$;
REVOKE ALL ON FUNCTION public.get_community_spaces() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_spaces() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_learner_email()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');
  IF v_email IS NULL OR v_email = '' THEN RETURN NULL; END IF;
  IF public.is_known_learner(v_email) THEN RETURN v_email; END IF;
  RETURN NULL;
END $$;