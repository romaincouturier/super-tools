ALTER TABLE public.game_authors
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS onboarding_status text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS siren text,
  ADD COLUMN IF NOT EXISTS postal_address text,
  ADD COLUMN IF NOT EXISTS legal_rep_name text;

ALTER TABLE public.game_authors ADD CONSTRAINT game_authors_onboarding_status_check
  CHECK (onboarding_status IS NULL OR onboarding_status IN ('invited','form_in_progress','form_submitted','contract_sent','signed','online'));

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS location_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_tarif_ht numeric,
  ADD COLUMN IF NOT EXISTS weight_g integer,
  ADD COLUMN IF NOT EXISTS package_dimensions text,
  ADD COLUMN IF NOT EXISTS shipping_fee numeric,
  ADD COLUMN IF NOT EXISTS shipping_delay text,
  ADD COLUMN IF NOT EXISTS pitch text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS proposed_price_ht numeric,
  ADD COLUMN IF NOT EXISTS onboarding_status text;

CREATE TABLE public.author_onboarding_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  author_id uuid NOT NULL REFERENCES public.game_authors(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  commission_rate numeric NOT NULL DEFAULT 0.15 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  recipient_email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  invitation_sent_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.author_onboarding_invitations TO authenticated;
GRANT ALL ON public.author_onboarding_invitations TO service_role;
ALTER TABLE public.author_onboarding_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage author invitations" ON public.author_onboarding_invitations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

CREATE TABLE public.author_onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL UNIQUE REFERENCES public.author_onboarding_invitations(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.author_onboarding_responses TO authenticated;
GRANT ALL ON public.author_onboarding_responses TO service_role;
ALTER TABLE public.author_onboarding_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage author responses" ON public.author_onboarding_responses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

CREATE TABLE public.author_onboarding_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.author_onboarding_invitations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo','photo','pdf')),
  storage_path text NOT NULL,
  original_name text,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.author_onboarding_files TO authenticated;
GRANT ALL ON public.author_onboarding_files TO service_role;
ALTER TABLE public.author_onboarding_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage author files" ON public.author_onboarding_files FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

CREATE TABLE public.distribution_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.author_onboarding_invitations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.game_authors(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  contrat_reference text NOT NULL UNIQUE,
  recipient_email text NOT NULL,
  recipient_name text,
  game_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_url text,
  pdf_document_id text,
  pdf_hash text,
  signed_pdf_url text,
  signed_pdf_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','cancelled','expired')),
  signed_at timestamptz,
  email_sent_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  confirmation_email_sent_at timestamptz,
  signature_data text,
  ip_address text,
  user_agent text,
  audit_metadata jsonb,
  journey_events jsonb,
  proof_file_url text,
  proof_hash text,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer NOT NULL DEFAULT 0,
  otp_sent_count integer NOT NULL DEFAULT 0,
  otp_last_sent_at timestamptz,
  otp_verified_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX distribution_contract_one_pending_per_invitation
  ON public.distribution_contract_signatures(invitation_id) WHERE status = 'pending';
GRANT SELECT ON public.distribution_contract_signatures TO authenticated;
GRANT ALL ON public.distribution_contract_signatures TO service_role;
ALTER TABLE public.distribution_contract_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read distribution contracts" ON public.distribution_contract_signatures FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

CREATE TABLE public.distribution_contract_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.distribution_contract_counters TO service_role;
ALTER TABLE public.distribution_contract_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_distribution_contract_reference()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y integer := extract(year FROM (now() AT TIME ZONE 'Europe/Paris'))::integer; n integer;
BEGIN
  INSERT INTO public.distribution_contract_counters(year, last_value) VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = distribution_contract_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN 'DIST-' || y || '-' || lpad(n::text, 3, '0');
END $$;
REVOKE ALL ON FUNCTION public.next_distribution_contract_reference() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_distribution_contract_reference() TO service_role;

CREATE POLICY "Dropshipping staff read author onboarding files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'author-onboarding' AND (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping')));