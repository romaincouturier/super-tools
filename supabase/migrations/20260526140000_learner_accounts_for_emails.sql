-- Back-office helper: given a list of learner emails, return those that already
-- have a Supabase auth account (i.e. the learner created their e-learning
-- account after receiving the magic link). Used by the participant list to flag
-- who still needs to onboard and to highlight the magic-link resend button.
CREATE OR REPLACE FUNCTION public.learner_accounts_for_emails(p_emails text[])
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(p_emails) AS e);
$$;

REVOKE ALL ON FUNCTION public.learner_accounts_for_emails(text[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.learner_accounts_for_emails(text[]) TO authenticated;
