
-- 1. Fix mutable search_path on update_contact_last_interaction
CREATE OR REPLACE FUNCTION public.update_contact_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE network_contacts
  SET last_contact_date = (NEW.created_at AT TIME ZONE 'UTC')::date
  WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$function$;

-- 2. Fix update_api_key_last_used missing search_path
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE api_keys SET last_used_at = now() WHERE id = key_id;
END;
$function$;

-- 3. Tighten app_settings: write = admin only
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.app_settings;
CREATE POLICY "Admins can insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Tighten email_templates: write = admin only
DROP POLICY IF EXISTS "Authenticated users can insert email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can update email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can delete email templates" ON public.email_templates;
CREATE POLICY "Admins can insert email templates" ON public.email_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update email templates" ON public.email_templates FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete email templates" ON public.email_templates FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 5. Tighten formation_configs: write = admin only (read stays open for authenticated)
DROP POLICY IF EXISTS "Authenticated users can insert formation configs" ON public.formation_configs;
DROP POLICY IF EXISTS "Authenticated users can update formation configs" ON public.formation_configs;
DROP POLICY IF EXISTS "Authenticated users can delete formation configs" ON public.formation_configs;
CREATE POLICY "Admins can insert formation configs" ON public.formation_configs FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update formation configs" ON public.formation_configs FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete formation configs" ON public.formation_configs FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
