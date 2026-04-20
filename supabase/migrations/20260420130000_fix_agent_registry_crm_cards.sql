-- Corrects the agent_schema_registry entry for crm_cards.
--
-- The original seed used wrong column names (contact_email, contact_phone)
-- that do not exist in the real table. This caused every agent SQL query
-- that touched contact data to fail at the EXPLAIN validation stage,
-- making Claude report "all systems inaccessible".
--
-- Also adds company, acquisition_source, and the new SIREN address fields
-- added in 20260420120000_sync_quote_to_opportunity.sql.

UPDATE public.agent_schema_registry
SET columns = '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description_html","type":"TEXT"},
  {"name":"sales_status","type":"TEXT","description":"OPEN, WON, LOST, CANCELED"},
  {"name":"status_operational","type":"TEXT","description":"TODAY, WAITING"},
  {"name":"estimated_value","type":"NUMERIC"},
  {"name":"column_id","type":"UUID FK→crm_columns"},
  {"name":"company","type":"TEXT"},
  {"name":"first_name","type":"TEXT"},
  {"name":"last_name","type":"TEXT"},
  {"name":"email","type":"TEXT"},
  {"name":"phone","type":"TEXT"},
  {"name":"website_url","type":"TEXT"},
  {"name":"service_type","type":"TEXT","description":"formation, mission"},
  {"name":"acquisition_source","type":"TEXT"},
  {"name":"siren","type":"TEXT"},
  {"name":"address","type":"TEXT"},
  {"name":"postal_code","type":"TEXT"},
  {"name":"city","type":"TEXT"},
  {"name":"country","type":"TEXT"},
  {"name":"waiting_next_action_text","type":"TEXT"},
  {"name":"waiting_next_action_date","type":"DATE"},
  {"name":"confidence_score","type":"INT"},
  {"name":"won_at","type":"TIMESTAMPTZ"},
  {"name":"lost_at","type":"TIMESTAMPTZ"},
  {"name":"created_at","type":"TIMESTAMPTZ"},
  {"name":"updated_at","type":"TIMESTAMPTZ"}
]'::jsonb
WHERE table_name = 'crm_cards';
