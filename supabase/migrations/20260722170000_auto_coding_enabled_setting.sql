-- Interrupteur global du codage automatique des tickets support.
-- 'true' = un ticket glissé en vibe_coding déclenche le workflow Claude Code.
-- 'false' = aucun déclenchement (débrayage depuis le kanban support).

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('auto_coding_enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;
