CREATE OR REPLACE FUNCTION public.learner_can_read_community(_course_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := public.get_learner_email();
BEGIN
  IF v_email IS NULL THEN RETURN false; END IF;
  IF _course_id IS NULL THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM lms_enrollments e WHERE e.course_id = _course_id AND lower(e.learner_email) = v_email)
      OR EXISTS (SELECT 1 FROM training_participants tp JOIN trainings t ON t.id = tp.training_id
                 WHERE t.supports_lms_course_id = _course_id AND lower(tp.email) = v_email);
END $$;

CREATE OR REPLACE FUNCTION public.learner_can_read_practice_post(_post_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM practice_posts p WHERE p.id = _post_id
    AND (lower(p.author_email) = public.get_learner_email() OR public.learner_can_read_community(p.course_id)));
$$;

CREATE OR REPLACE FUNCTION public.learner_can_read_practice_poll(_poll_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM practice_polls pl WHERE pl.id = _poll_id AND public.learner_can_read_practice_post(pl.post_id));
$$;

GRANT EXECUTE ON FUNCTION public.learner_can_read_community(uuid), public.learner_can_read_practice_post(uuid), public.learner_can_read_practice_poll(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS anon_read_practice_posts ON public.practice_posts;
DROP POLICY IF EXISTS auth_learner_read_practice_posts ON public.practice_posts;
CREATE POLICY anon_read_practice_posts ON public.practice_posts FOR SELECT TO anon
  USING (lower(author_email) = public.get_learner_email() OR public.learner_can_read_community(course_id));
CREATE POLICY auth_learner_read_practice_posts ON public.practice_posts FOR SELECT TO authenticated
  USING (lower(author_email) = public.get_learner_email() OR public.learner_can_read_community(course_id));

DROP POLICY IF EXISTS anon_read_practice_comments ON public.practice_post_comments;
DROP POLICY IF EXISTS auth_learner_read_practice_comments ON public.practice_post_comments;
CREATE POLICY anon_read_practice_comments ON public.practice_post_comments FOR SELECT TO anon USING (public.learner_can_read_practice_post(post_id));
CREATE POLICY auth_learner_read_practice_comments ON public.practice_post_comments FOR SELECT TO authenticated USING (public.learner_can_read_practice_post(post_id));

DROP POLICY IF EXISTS anon_read_practice_reactions ON public.practice_post_reactions;
DROP POLICY IF EXISTS auth_learner_read_practice_reactions ON public.practice_post_reactions;
CREATE POLICY anon_read_practice_reactions ON public.practice_post_reactions FOR SELECT TO anon USING (public.learner_can_read_practice_post(post_id));
CREATE POLICY auth_learner_read_practice_reactions ON public.practice_post_reactions FOR SELECT TO authenticated USING (public.learner_can_read_practice_post(post_id));

DROP POLICY IF EXISTS anon_read_practice_hashtags ON public.practice_post_hashtags;
DROP POLICY IF EXISTS auth_learner_read_practice_hashtags ON public.practice_post_hashtags;
CREATE POLICY anon_read_practice_hashtags ON public.practice_post_hashtags FOR SELECT TO anon USING (public.learner_can_read_practice_post(post_id));
CREATE POLICY auth_learner_read_practice_hashtags ON public.practice_post_hashtags FOR SELECT TO authenticated USING (public.learner_can_read_practice_post(post_id));

DROP POLICY IF EXISTS anon_read_practice_polls ON public.practice_polls;
DROP POLICY IF EXISTS auth_learner_read_practice_polls ON public.practice_polls;
CREATE POLICY anon_read_practice_polls ON public.practice_polls FOR SELECT TO anon USING (public.learner_can_read_practice_post(post_id));
CREATE POLICY auth_learner_read_practice_polls ON public.practice_polls FOR SELECT TO authenticated USING (public.learner_can_read_practice_post(post_id));

DROP POLICY IF EXISTS anon_read_practice_poll_options ON public.practice_poll_options;
DROP POLICY IF EXISTS auth_learner_read_practice_poll_options ON public.practice_poll_options;
CREATE POLICY anon_read_practice_poll_options ON public.practice_poll_options FOR SELECT TO anon USING (public.learner_can_read_practice_poll(poll_id));
CREATE POLICY auth_learner_read_practice_poll_options ON public.practice_poll_options FOR SELECT TO authenticated USING (public.learner_can_read_practice_poll(poll_id));

DROP POLICY IF EXISTS anon_read_practice_poll_votes ON public.practice_poll_votes;
DROP POLICY IF EXISTS auth_learner_read_practice_poll_votes ON public.practice_poll_votes;
CREATE POLICY anon_read_practice_poll_votes ON public.practice_poll_votes FOR SELECT TO anon USING (public.learner_can_read_practice_poll(poll_id));
CREATE POLICY auth_learner_read_practice_poll_votes ON public.practice_poll_votes FOR SELECT TO authenticated USING (public.learner_can_read_practice_poll(poll_id));

CREATE OR REPLACE FUNCTION public.practice_popular_hashtags(p_limit integer DEFAULT 5)
RETURNS TABLE(tag text, post_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select h.tag, count(distinct h.post_id) as post_count
  from practice_post_hashtags h
  where public.is_staff_user() or public.learner_can_read_practice_post(h.post_id)
  group by h.tag
  order by post_count desc, h.tag asc
  limit greatest(coalesce(p_limit, 5), 0);
$$;