CREATE TABLE public.password_setup_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_setup_links TO service_role;
ALTER TABLE public.password_setup_links ENABLE ROW LEVEL SECURITY;
CREATE INDEX password_setup_links_email_idx ON public.password_setup_links (email);
COMMENT ON TABLE public.password_setup_links IS 'Liens SuperTools de création/réinitialisation de mot de passe (7 j depuis les mails d''accès, 24 h sur redemande). Jeton haché, lu uniquement par les fonctions serveur.';