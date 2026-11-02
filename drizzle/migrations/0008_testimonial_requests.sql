CREATE TABLE public.testimonial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  training_id uuid,
  contact_name text,
  contact_email text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done','dismissed')),
  source text NOT NULL DEFAULT 'auto',
  source_draft_id uuid,
  note text,
  done_at timestamptz,
  done_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX testimonial_requests_mission_contact_uq
  ON public.testimonial_requests (mission_id, lower(contact_email)) WHERE mission_id IS NOT NULL;
CREATE INDEX testimonial_requests_status_idx ON public.testimonial_requests (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonial_requests TO authenticated;
GRANT ALL ON public.testimonial_requests TO service_role;
ALTER TABLE public.testimonial_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage testimonial requests" ON public.testimonial_requests
  FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

ALTER TABLE public.mission_email_drafts DROP CONSTRAINT mission_email_drafts_status_check;
ALTER TABLE public.mission_email_drafts ADD CONSTRAINT mission_email_drafts_status_check
  CHECK (status = ANY (ARRAY['pending','approved','scheduled','sent','rejected','converted']));
COMMENT ON TABLE public.mission_email_drafts IS 'DEPRECATED: read-only history; testimonial requests are now signals in testimonial_requests';

INSERT INTO public.testimonial_requests (mission_id, contact_name, contact_email, source, source_draft_id, created_at)
SELECT DISTINCT ON (d.mission_id, lower(d.contact_email)) d.mission_id, d.contact_name, d.contact_email, 'converted_draft', d.id, d.created_at
FROM public.mission_email_drafts d
WHERE d.status IN ('pending','scheduled') AND d.mission_id IS NOT NULL
ORDER BY d.mission_id, lower(d.contact_email), d.created_at;