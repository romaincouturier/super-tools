CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.execution_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('mission','training')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','refused','expired','cancelled')),
  provider_name text, provider_siren text, provider_nda text, provider_address text,
  client_name text, client_address text,
  signer_name text, signer_function text, signer_email text,
  is_public_entity boolean NOT NULL DEFAULT false,
  public_entity_name text, public_contract_reference text,
  subject text, start_date date, end_date date, location text,
  participants_count integer, days_count numeric, amount_ht numeric,
  free_text text,
  certification_text text NOT NULL DEFAULT 'Nous attestons que la prestation décrite ci-dessus a été réalisée conformément à nos attentes et dans les règles de l''art.',
  token_hash text UNIQUE,
  sent_at timestamptz, expires_at timestamptz, link_validity_days integer NOT NULL DEFAULT 30,
  signed_at timestamptz, refused_at timestamptz, refusal_reason text,
  signed_signer_name text, signed_signer_function text,
  signature_image text, ip_address text, user_agent text, device_info jsonb,
  journey_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text, signed_pdf_path text, signed_pdf_hash text, email_sent_at timestamptz,
  created_by uuid DEFAULT auth.uid(), updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT execution_attestations_one_source CHECK (
    (source_type = 'mission' AND training_id IS NULL) OR (source_type = 'training' AND mission_id IS NULL))
);
CREATE INDEX execution_attestations_mission_idx ON public.execution_attestations(mission_id);
CREATE INDEX execution_attestations_training_idx ON public.execution_attestations(training_id);

GRANT SELECT, INSERT, UPDATE ON public.execution_attestations TO authenticated;
GRANT ALL ON public.execution_attestations TO service_role;
ALTER TABLE public.execution_attestations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_attestation_source(_source_type text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_admin(auth.uid())
    OR public.has_module_access(auth.uid(), CASE WHEN _source_type = 'mission' THEN 'missions' ELSE 'formations' END));
$$;

CREATE POLICY attestations_select ON public.execution_attestations FOR SELECT TO authenticated
  USING (public.can_access_attestation_source(source_type));
CREATE POLICY attestations_insert ON public.execution_attestations FOR INSERT TO authenticated
  WITH CHECK (public.can_access_attestation_source(source_type) AND status = 'draft' AND token_hash IS NULL);
CREATE POLICY attestations_update ON public.execution_attestations FOR UPDATE TO authenticated
  USING (public.can_access_attestation_source(source_type) AND status IN ('draft','sent','expired','refused'))
  WITH CHECK (public.can_access_attestation_source(source_type) AND status IN ('draft','cancelled'));

-- Staff edits: any content change returns to draft and invalidates the link; signature columns are server-only.
CREATE OR REPLACE FUNCTION public.execution_attestations_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE is_service boolean := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'service_role' OR current_user IN ('postgres','service_role');
BEGIN
  NEW.updated_at := now();
  IF is_service THEN RETURN NEW; END IF;
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'signed' THEN RAISE EXCEPTION 'Attestation signée : modification impossible'; END IF;
    NEW.source_type := OLD.source_type; NEW.mission_id := OLD.mission_id; NEW.training_id := OLD.training_id;
    NEW.signed_at := OLD.signed_at; NEW.signature_image := OLD.signature_image; NEW.signed_pdf_path := OLD.signed_pdf_path;
    NEW.signed_pdf_hash := OLD.signed_pdf_hash; NEW.content_hash := OLD.content_hash; NEW.ip_address := OLD.ip_address;
    NEW.journey_events := OLD.journey_events; NEW.created_by := OLD.created_by;
    IF NEW.token_hash IS DISTINCT FROM OLD.token_hash THEN NEW.token_hash := OLD.token_hash; END IF;
    IF NEW.status <> 'cancelled' THEN
      NEW.status := 'draft'; NEW.token_hash := NULL; NEW.sent_at := NULL; NEW.expires_at := NULL;
      NEW.refused_at := NULL; NEW.refusal_reason := NULL;
    ELSE
      NEW.token_hash := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER execution_attestations_guard BEFORE INSERT OR UPDATE ON public.execution_attestations
  FOR EACH ROW EXECUTE FUNCTION public.execution_attestations_guard();

CREATE OR REPLACE FUNCTION public.execution_attestations_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.activity_logs(action_type, recipient_email, details, user_id)
    VALUES ('execution_attestation_' || NEW.status, NEW.signer_email,
      jsonb_build_object('attestation_id', NEW.id, 'source_type', NEW.source_type,
        'mission_id', NEW.mission_id, 'training_id', NEW.training_id,
        'previous_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER execution_attestations_audit AFTER INSERT OR UPDATE ON public.execution_attestations
  FOR EACH ROW EXECUTE FUNCTION public.execution_attestations_audit();

-- Prefilled draft from a mission or a training (UI and MCP share it).
CREATE OR REPLACE FUNCTION public.create_execution_attestation(p_mission_id uuid DEFAULT NULL, p_training_id uuid DEFAULT NULL, p_overrides jsonb DEFAULT '{}'::jsonb)
RETURNS public.execution_attestations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.execution_attestations; qs record; m record; t record; c record; n integer; o jsonb := coalesce(p_overrides,'{}'::jsonb);
BEGIN
  IF (p_mission_id IS NULL) = (p_training_id IS NULL) THEN RAISE EXCEPTION 'Indiquer une mission ou une formation, pas les deux'; END IF;
  SELECT * INTO qs FROM public.quote_settings LIMIT 1;
  r.provider_name := qs.company_name; r.provider_siren := qs.siren; r.provider_nda := qs.training_declaration_number;
  r.provider_address := concat_ws(', ', nullif(qs.company_address,''), nullif(concat_ws(' ', qs.company_zip, qs.company_city),''));
  IF p_mission_id IS NOT NULL THEN
    SELECT * INTO m FROM public.missions WHERE id = p_mission_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;
    SELECT * INTO c FROM public.mission_contacts WHERE mission_id = p_mission_id ORDER BY is_sponsor DESC NULLS LAST, is_primary DESC NULLS LAST, position LIMIT 1;
    r.source_type := 'mission'; r.mission_id := p_mission_id;
    r.client_name := m.client_name; r.subject := m.title; r.start_date := m.start_date; r.end_date := m.end_date;
    r.location := m.location; r.days_count := m.total_days; r.amount_ht := coalesce(nullif(m.billed_amount,0), m.initial_amount, m.total_amount);
    IF c.id IS NOT NULL THEN r.signer_name := nullif(concat_ws(' ', c.first_name, c.last_name),''); r.signer_function := c.role; r.signer_email := c.email; END IF;
  ELSE
    SELECT * INTO t FROM public.trainings WHERE id = p_training_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Formation introuvable'; END IF;
    SELECT count(*) INTO n FROM public.training_participants WHERE training_id = p_training_id;
    r.source_type := 'training'; r.training_id := p_training_id;
    r.client_name := t.client_name; r.client_address := t.client_address; r.subject := t.training_name;
    r.start_date := t.start_date; r.end_date := t.end_date; r.location := t.location; r.participants_count := n;
    r.amount_ht := t.sold_price_ht;
    r.signer_name := nullif(concat_ws(' ', t.sponsor_first_name, t.sponsor_last_name),''); r.signer_email := t.sponsor_email;
  END IF;
  INSERT INTO public.execution_attestations(source_type, mission_id, training_id, provider_name, provider_siren, provider_nda, provider_address,
    client_name, client_address, signer_name, signer_function, signer_email, is_public_entity, public_entity_name, public_contract_reference,
    subject, start_date, end_date, location, participants_count, days_count, amount_ht, free_text, certification_text, link_validity_days)
  VALUES (r.source_type, r.mission_id, r.training_id, r.provider_name, r.provider_siren, r.provider_nda, r.provider_address,
    CASE WHEN o ? 'client_name' THEN o->>'client_name' ELSE r.client_name END,
    CASE WHEN o ? 'client_address' THEN o->>'client_address' ELSE r.client_address END,
    CASE WHEN o ? 'signer_name' THEN o->>'signer_name' ELSE r.signer_name END,
    CASE WHEN o ? 'signer_function' THEN o->>'signer_function' ELSE r.signer_function END,
    CASE WHEN o ? 'signer_email' THEN o->>'signer_email' ELSE r.signer_email END,
    coalesce((o->>'is_public_entity')::boolean, false), o->>'public_entity_name', o->>'public_contract_reference',
    CASE WHEN o ? 'subject' THEN o->>'subject' ELSE r.subject END,
    CASE WHEN o ? 'start_date' THEN (o->>'start_date')::date ELSE r.start_date END,
    CASE WHEN o ? 'end_date' THEN (o->>'end_date')::date ELSE r.end_date END,
    CASE WHEN o ? 'location' THEN o->>'location' ELSE r.location END,
    CASE WHEN o ? 'participants_count' THEN (o->>'participants_count')::integer ELSE r.participants_count END,
    CASE WHEN o ? 'days_count' THEN (o->>'days_count')::numeric ELSE r.days_count END,
    CASE WHEN o ? 'amount_ht' THEN (o->>'amount_ht')::numeric ELSE r.amount_ht END,
    o->>'free_text',
    coalesce(o->>'certification_text', 'Nous attestons que la prestation décrite ci-dessus a été réalisée conformément à nos attentes et dans les règles de l''art.'),
    coalesce((o->>'link_validity_days')::integer, 30))
  RETURNING * INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.create_execution_attestation(uuid, uuid, jsonb) TO authenticated;

-- Signing link: random 256-bit token, only its hash is stored; regenerating invalidates the previous one.
CREATE OR REPLACE FUNCTION public.generate_execution_attestation_link(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE a public.execution_attestations; tok text; exp timestamptz;
BEGIN
  SELECT * INTO a FROM public.execution_attestations WHERE id = p_id;
  IF NOT FOUND OR NOT public.can_access_attestation_source(a.source_type) THEN RAISE EXCEPTION 'Attestation introuvable'; END IF;
  IF a.status IN ('signed','cancelled') THEN RAISE EXCEPTION 'Attestation % : lien impossible', a.status; END IF;
  IF coalesce(trim(a.subject),'') = '' OR coalesce(trim(a.client_name),'') = '' THEN RAISE EXCEPTION 'Objet et client requis'; END IF;
  IF a.is_public_entity AND (coalesce(trim(a.public_entity_name),'') = '' OR coalesce(trim(a.signer_name),'') = '' OR coalesce(trim(a.signer_function),'') = '') THEN
    RAISE EXCEPTION 'Collectivité territoriale : nom de la collectivité, nom et fonction du signataire requis';
  END IF;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  exp := now() + make_interval(days => greatest(1, a.link_validity_days));
  UPDATE public.execution_attestations SET token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'),
    status = 'sent', sent_at = now(), expires_at = exp, refused_at = NULL, refusal_reason = NULL, updated_by = auth.uid()
  WHERE id = p_id;
  RETURN jsonb_build_object('token', tok, 'expires_at', exp);
END $$;
REVOKE ALL ON FUNCTION public.generate_execution_attestation_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_execution_attestation_link(uuid) TO authenticated;

COMMENT ON TABLE public.execution_attestations IS 'Attestations de bonne exécution signées en ligne (missions et formations).';