-- Agent/MCP — table media (galeries des missions, cartes CRM, contenus)
-- au registry : nécessaire pour lister les photos d'atelier d'une mission.

INSERT INTO public.agent_schema_registry (table_name, description, columns, display_order) VALUES
('media', 'Galeries de fichiers (photos, images) rattachées aux entités (source_type: mission, crm_card, content_card, event…)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"source_type","type":"TEXT","description":"mission, crm_card, content_card, event…"},
  {"name":"source_id","type":"UUID","description":"id de l''entité propriétaire"},
  {"name":"file_name","type":"TEXT"},
  {"name":"file_url","type":"TEXT"},
  {"name":"file_type","type":"TEXT"},
  {"name":"mime_type","type":"TEXT"},
  {"name":"file_size","type":"INT"},
  {"name":"position","type":"INT","description":"ordre dans la galerie"},
  {"name":"tags","type":"TEXT[]"},
  {"name":"transcript","type":"TEXT","description":"transcription du média si générée"},
  {"name":"is_deliverable","type":"BOOL"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 48)
ON CONFLICT (table_name) DO NOTHING;
