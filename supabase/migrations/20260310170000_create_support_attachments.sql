-- Support ticket attachments table
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket_id
  ON public.support_ticket_attachments(ticket_id);

-- RLS
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_attachments_insert ON public.support_ticket_attachments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY support_attachments_select ON public.support_ticket_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY support_attachments_delete ON public.support_ticket_attachments
  FOR DELETE TO authenticated USING (true);

-- Storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "support_attachments_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments');

CREATE POLICY "support_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments');

CREATE POLICY "support_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments');
