-- Source Loom pour les transcripts.
--
-- Loom n'a pas d'API publique et le plan gratuit ne permet pas de télécharger
-- les sous-titres : poll-loom-transcripts passe par l'API GraphQL interne,
-- authentifiée par le cookie de session stocké dans
-- app_settings.loom_session_cookie (lecture réservée aux admins).
--
-- NOTE (règle [036]) : le cron horaire n'est PAS planifié ici, car le header
-- d'authentification porte un secret qui n'a pas à être committé. À créer une
-- fois dans l'éditeur SQL Supabase, avec la valeur de TRANSCRIPTS_CRON_SECRET
-- (secret d'edge function) :
--
--   SELECT cron.schedule(
--     'poll-loom-transcripts',
--     '15 * * * *',
--     $$SELECT net.http_post(
--       url := 'https://yewffntzgrdgztrwtava.supabase.co/functions/v1/poll-loom-transcripts',
--       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<TRANSCRIPTS_CRON_SECRET>'),
--       body := '{}'::jsonb
--     ) AS request_id;$$
--   );

ALTER TABLE public.transcripts DROP CONSTRAINT transcripts_source_check;
ALTER TABLE public.transcripts ADD CONSTRAINT transcripts_source_check
  CHECK (source IN ('google_drive','fireflies','dictation','loom'));

ALTER TABLE public.polling_cursors DROP CONSTRAINT polling_cursors_source_check;
ALTER TABLE public.polling_cursors ADD CONSTRAINT polling_cursors_source_check
  CHECK (source IN ('drive_transcripts','drive_testimonials','fireflies','woocommerce','loom'));

INSERT INTO public.polling_cursors (source) VALUES ('loom')
  ON CONFLICT (source) DO NOTHING;

INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES (
  'loom_session_cookie',
  '',
  'Cookie de session Loom (connect.sid) utilisé par poll-loom-transcripts. Expire environ tous les 30 jours.'
) ON CONFLICT (setting_key) DO NOTHING;
