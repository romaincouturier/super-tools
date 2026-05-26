
CREATE TABLE public.lms_deposit_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.lms_work_deposits(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deposit_id, author_email)
);
CREATE INDEX lms_deposit_reactions_deposit_idx ON public.lms_deposit_reactions(deposit_id);

GRANT SELECT, INSERT, DELETE ON public.lms_deposit_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_deposit_reactions TO authenticated;
GRANT ALL ON public.lms_deposit_reactions TO service_role;

ALTER TABLE public.lms_deposit_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_deposit_reactions"
  ON public.lms_deposit_reactions FOR SELECT TO anon
  USING (get_learner_email() IS NOT NULL);

CREATE POLICY "anon_insert_deposit_reactions"
  ON public.lms_deposit_reactions FOR INSERT TO anon
  WITH CHECK (
    author_email = get_learner_email()
    AND EXISTS (
      SELECT 1 FROM public.lms_work_deposits d
      WHERE d.id = lms_deposit_reactions.deposit_id
        AND d.visibility = 'shared'
        AND d.publication_status = 'published'
        AND lms_learner_is_enrolled(d.course_id)
    )
  );

CREATE POLICY "anon_delete_deposit_reactions"
  ON public.lms_deposit_reactions FOR DELETE TO anon
  USING (author_email = get_learner_email());

CREATE POLICY "auth_manage_deposit_reactions"
  ON public.lms_deposit_reactions TO authenticated
  USING (true) WITH CHECK (true);
