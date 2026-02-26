
-- Table dédiée aux emails post-évaluation par formation
CREATE TABLE public.post_evaluation_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_filter TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_evaluation_emails ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read
CREATE POLICY "Authenticated users can read post_evaluation_emails"
  ON public.post_evaluation_emails FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can manage
CREATE POLICY "Admins can manage post_evaluation_emails"
  ON public.post_evaluation_emails FOR ALL
  USING (public.is_admin(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_post_evaluation_emails_updated_at
  BEFORE UPDATE ON public.post_evaluation_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from app_settings
INSERT INTO public.post_evaluation_emails (training_filter, subject, html_content)
SELECT
  COALESCE((SELECT setting_value FROM public.app_settings WHERE setting_key = 'post_evaluation_email_training_filter'), ''),
  COALESCE((SELECT setting_value FROM public.app_settings WHERE setting_key = 'post_evaluation_email_subject'), ''),
  COALESCE((SELECT setting_value FROM public.app_settings WHERE setting_key = 'post_evaluation_email_content'), '')
WHERE EXISTS (
  SELECT 1 FROM public.app_settings 
  WHERE setting_key = 'post_evaluation_email_training_filter' 
  AND setting_value IS NOT NULL AND setting_value != ''
);
