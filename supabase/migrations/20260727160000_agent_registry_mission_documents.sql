-- Agent/MCP — mission_documents au registry : fichiers déposés sur les
-- missions (photos d'ateliers, livrables), nécessaires au cas "dossier
-- mission complet" (métadonnées + URLs des fichiers).

INSERT INTO public.agent_schema_registry (table_name, description, columns, display_order) VALUES
('mission_documents', 'Fichiers déposés sur les missions (photos, audio, livrables)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"mission_id","type":"UUID FK→missions"},
  {"name":"file_name","type":"TEXT"},
  {"name":"file_url","type":"TEXT"},
  {"name":"mime_type","type":"TEXT"},
  {"name":"file_size","type":"INT"},
  {"name":"is_deliverable","type":"BOOL"},
  {"name":"processing_status","type":"TEXT","description":"traitement audio/transcription éventuel"},
  {"name":"transcript_page_id","type":"UUID","description":"page mission créée par la transcription du fichier"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 47)
ON CONFLICT (table_name) DO NOTHING;
