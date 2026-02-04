-- Add website_url column to crm_cards
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Create crm_settings table for CRM-specific settings
CREATE TABLE IF NOT EXISTS public.crm_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on crm_settings
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for crm_settings (authenticated users with CRM access)
CREATE POLICY "Authenticated users with CRM access can view CRM settings"
  ON public.crm_settings
  FOR SELECT
  USING (public.has_crm_access(auth.uid()));

CREATE POLICY "Authenticated users with CRM access can insert CRM settings"
  ON public.crm_settings
  FOR INSERT
  WITH CHECK (public.has_crm_access(auth.uid()));

CREATE POLICY "Authenticated users with CRM access can update CRM settings"
  ON public.crm_settings
  FOR UPDATE
  USING (public.has_crm_access(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_crm_settings_updated_at
  BEFORE UPDATE ON public.crm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();