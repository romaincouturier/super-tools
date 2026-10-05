INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES
  ('mcp_allowed_email', 'romain@supertilt.fr', 'Adresse email autorisée à utiliser le serveur MCP'),
  ('nocrm_bcc_email', 'supertilt@bcc.nocrm.io', 'Adresse de copie cachée (BCC) vers noCRM ajoutée à tous les envois'),
  ('agent_author_email', 'agent@supertools.ai', 'Adresse email d''auteur utilisée par l''agent IA pour ses commentaires')
ON CONFLICT (setting_key) DO NOTHING;