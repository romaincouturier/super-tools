-- Agent — colonnes manquantes sur l'entrée trainings du registry :
-- sans is_cancelled les comptages incluent les formations annulées,
-- sans convention_file_url l'agent ne peut pas repérer les conventions
-- manquantes (questions 1 et 23 du jeu d'évals docs/agent-evals.md).

UPDATE public.agent_schema_registry
SET columns = columns || '[
  {"name":"is_cancelled","type":"BOOL","description":"true = formation annulée, à exclure des comptages"},
  {"name":"max_participants","type":"INT"},
  {"name":"convention_file_url","type":"TEXT","description":"NULL = convention pas encore générée/signée"},
  {"name":"evaluation_link","type":"TEXT"}
]'::jsonb,
updated_at = now()
WHERE table_name = 'trainings'
  AND NOT columns @> '[{"name":"is_cancelled"}]'::jsonb;
