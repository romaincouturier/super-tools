-- Create app_settings table for application-wide configuration
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Authenticated users can view settings" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (true);

-- Allow authenticated users to update settings
CREATE POLICY "Authenticated users can update settings" 
ON public.app_settings 
FOR UPDATE 
TO authenticated
USING (true);

-- Allow authenticated users to insert settings
CREATE POLICY "Authenticated users can insert settings" 
ON public.app_settings 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default BCC setting
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES ('bcc_email', 'romain@supertilt.fr', 'Adresse email en copie cachée (BCC) pour tous les envois');