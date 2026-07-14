CREATE TABLE IF NOT EXISTS public.crm_scheduled_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.crm_cards(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  attachments JSONB DEFAULT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_scheduled_emails TO authenticated;
GRANT ALL ON public.crm_scheduled_emails TO service_role;

ALTER TABLE public.crm_scheduled_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can update scheduled emails" ON public.crm_scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can delete scheduled emails" ON public.crm_scheduled_emails;

CREATE POLICY "Authenticated users can view scheduled emails"
ON public.crm_scheduled_emails FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert scheduled emails"
ON public.crm_scheduled_emails FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scheduled emails"
ON public.crm_scheduled_emails FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete scheduled emails"
ON public.crm_scheduled_emails FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_crm_scheduled_emails_pending
  ON public.crm_scheduled_emails(scheduled_at) WHERE status = 'pending';