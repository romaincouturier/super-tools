-- Add crm_activity_log to the agent schema registry so the AI agent
-- can query CRM history (card moves, status changes, comments, emails, etc.).
-- Without this entry the allowlist check in agent_sql_query rejects every
-- query that references crm_activity_log, causing the agent to report
-- "système inaccessible" when asked to analyse CRM activity over a period.

INSERT INTO public.agent_schema_registry (table_name, description, columns, display_order)
VALUES (
  'crm_activity_log',
  'Historique des actions sur les fiches CRM (déplacements, changements de statut, commentaires, emails)',
  '[
    {"name":"id","type":"UUID PK"},
    {"name":"card_id","type":"UUID FK→crm_cards"},
    {"name":"action_type","type":"TEXT","description":"card_created, card_moved, status_operational_changed, sales_status_changed, estimated_value_changed, tag_added, tag_removed, comment_added, attachment_added, attachment_removed, email_sent, action_scheduled, micro_devis_sent"},
    {"name":"old_value","type":"TEXT"},
    {"name":"new_value","type":"TEXT"},
    {"name":"metadata","type":"JSONB"},
    {"name":"actor_email","type":"TEXT"},
    {"name":"created_at","type":"TIMESTAMPTZ"}
  ]'::jsonb,
  9
)
ON CONFLICT (table_name) DO UPDATE
  SET
    description = EXCLUDED.description,
    columns     = EXCLUDED.columns,
    updated_at  = now();
