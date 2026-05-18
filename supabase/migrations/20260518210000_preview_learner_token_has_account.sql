-- Update preview_learner_token to also indicate whether a Supabase auth account
-- already exists for this email. This allows the onboarding page to show the
-- correct form (create vs login) immediately, without requiring the user to
-- attempt signup first and then switch modes.

CREATE OR REPLACE FUNCTION public.preview_learner_token(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_link   learner_magic_links;
  v_exists boolean;
BEGIN
  SELECT * INTO v_link FROM learner_magic_links WHERE token = p_token LIMIT 1;

  IF v_link IS NULL THEN
    RETURN json_build_object('status', 'invalid');
  END IF;
  IF v_link.used_at IS NOT NULL THEN
    -- Even for used tokens, expose email so the login form can be pre-filled
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = v_link.email) INTO v_exists;
    RETURN json_build_object('status', 'used', 'email', v_link.email, 'has_account', v_exists);
  END IF;
  IF v_link.expires_at < now() THEN
    RETURN json_build_object('status', 'expired');
  END IF;

  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = v_link.email) INTO v_exists;

  RETURN json_build_object(
    'status',      'ok',
    'email',       v_link.email,
    'training_id', v_link.training_id,
    'has_account', v_exists
  );
END;
$$;
