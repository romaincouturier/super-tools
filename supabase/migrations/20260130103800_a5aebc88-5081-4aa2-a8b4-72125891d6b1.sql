-- Create email_templates table for reusable/configurable welcome emails
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_type TEXT NOT NULL, -- 'welcome', 'needs_survey', 'reminder', etc.
  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view email templates"
ON public.email_templates
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert email templates"
ON public.email_templates
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update email templates"
ON public.email_templates
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete email templates"
ON public.email_templates
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default welcome email template
INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default) VALUES
('welcome', 'Mail d''accueil standard', 'Bienvenue à votre formation {{training_name}}', 
'<p>Bonjour {{participant_first_name}},</p>
<p>Nous avons le plaisir de vous confirmer votre inscription à la formation <strong>{{training_name}}</strong> qui se tiendra le <strong>{{training_date}}</strong> à <strong>{{training_location}}</strong>.</p>
<p><strong>Informations pratiques :</strong></p>
<ul>
<li>Date : {{training_date}}</li>
<li>Horaires : {{training_schedule}}</li>
<li>Lieu : {{training_location}}</li>
</ul>
<p>Nous restons à votre disposition pour toute question.</p>
<p>À très bientôt !</p>', true);