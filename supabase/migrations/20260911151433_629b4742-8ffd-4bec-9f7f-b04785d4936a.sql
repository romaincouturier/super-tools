DROP POLICY IF EXISTS auth_learner_read_practice_posts ON public.practice_posts;
CREATE POLICY auth_learner_read_practice_posts ON public.practice_posts
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_posts ON public.practice_posts;
CREATE POLICY auth_learner_insert_practice_posts ON public.practice_posts
  FOR INSERT TO authenticated
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_update_practice_posts ON public.practice_posts;
CREATE POLICY auth_learner_update_practice_posts ON public.practice_posts
  FOR UPDATE TO authenticated
  USING (lower(author_email) = public.get_learner_email())
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_delete_practice_posts ON public.practice_posts;
CREATE POLICY auth_learner_delete_practice_posts ON public.practice_posts
  FOR DELETE TO authenticated
  USING (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_read_practice_comments ON public.practice_post_comments;
CREATE POLICY auth_learner_read_practice_comments ON public.practice_post_comments
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_comments ON public.practice_post_comments;
CREATE POLICY auth_learner_insert_practice_comments ON public.practice_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_update_practice_comments ON public.practice_post_comments;
CREATE POLICY auth_learner_update_practice_comments ON public.practice_post_comments
  FOR UPDATE TO authenticated
  USING (lower(author_email) = public.get_learner_email())
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_delete_practice_comments ON public.practice_post_comments;
CREATE POLICY auth_learner_delete_practice_comments ON public.practice_post_comments
  FOR DELETE TO authenticated
  USING (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_read_practice_reactions ON public.practice_post_reactions;
CREATE POLICY auth_learner_read_practice_reactions ON public.practice_post_reactions
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_reactions ON public.practice_post_reactions;
CREATE POLICY auth_learner_insert_practice_reactions ON public.practice_post_reactions
  FOR INSERT TO authenticated
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_delete_practice_reactions ON public.practice_post_reactions;
CREATE POLICY auth_learner_delete_practice_reactions ON public.practice_post_reactions
  FOR DELETE TO authenticated
  USING (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_read_practice_hashtags ON public.practice_post_hashtags;
CREATE POLICY auth_learner_read_practice_hashtags ON public.practice_post_hashtags
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_hashtags ON public.practice_post_hashtags;
CREATE POLICY auth_learner_insert_practice_hashtags ON public.practice_post_hashtags
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.practice_posts p
    WHERE p.id = post_id AND lower(p.author_email) = public.get_learner_email()
  ));

DROP POLICY IF EXISTS auth_learner_delete_practice_hashtags ON public.practice_post_hashtags;
CREATE POLICY auth_learner_delete_practice_hashtags ON public.practice_post_hashtags
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.practice_posts p
    WHERE p.id = post_id AND lower(p.author_email) = public.get_learner_email()
  ));

DROP POLICY IF EXISTS auth_learner_read_practice_polls ON public.practice_polls;
CREATE POLICY auth_learner_read_practice_polls ON public.practice_polls
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_polls ON public.practice_polls;
CREATE POLICY auth_learner_insert_practice_polls ON public.practice_polls
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.practice_posts p
    WHERE p.id = post_id AND lower(p.author_email) = public.get_learner_email()
  ));

DROP POLICY IF EXISTS auth_learner_delete_practice_polls ON public.practice_polls;
CREATE POLICY auth_learner_delete_practice_polls ON public.practice_polls
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.practice_posts p
    WHERE p.id = post_id AND lower(p.author_email) = public.get_learner_email()
  ));

DROP POLICY IF EXISTS auth_learner_read_practice_poll_options ON public.practice_poll_options;
CREATE POLICY auth_learner_read_practice_poll_options ON public.practice_poll_options
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_poll_options ON public.practice_poll_options;
CREATE POLICY auth_learner_insert_practice_poll_options ON public.practice_poll_options
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.practice_polls pl
    JOIN public.practice_posts p ON p.id = pl.post_id
    WHERE pl.id = poll_id AND lower(p.author_email) = public.get_learner_email()
  ));

DROP POLICY IF EXISTS auth_learner_read_practice_poll_votes ON public.practice_poll_votes;
CREATE POLICY auth_learner_read_practice_poll_votes ON public.practice_poll_votes
  FOR SELECT TO authenticated
  USING (public.get_learner_email() IS NOT NULL);

DROP POLICY IF EXISTS auth_learner_insert_practice_poll_votes ON public.practice_poll_votes;
CREATE POLICY auth_learner_insert_practice_poll_votes ON public.practice_poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_update_practice_poll_votes ON public.practice_poll_votes;
CREATE POLICY auth_learner_update_practice_poll_votes ON public.practice_poll_votes
  FOR UPDATE TO authenticated
  USING (lower(author_email) = public.get_learner_email())
  WITH CHECK (lower(author_email) = public.get_learner_email());

DROP POLICY IF EXISTS auth_learner_delete_practice_poll_votes ON public.practice_poll_votes;
CREATE POLICY auth_learner_delete_practice_poll_votes ON public.practice_poll_votes
  FOR DELETE TO authenticated
  USING (lower(author_email) = public.get_learner_email());