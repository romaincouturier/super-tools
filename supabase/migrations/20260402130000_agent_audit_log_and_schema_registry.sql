-- ============================================================
-- Agent improvements: audit log, schema registry, table allowlist
-- ============================================================

-- ============================================================
-- 1. Query audit log — tracks every SQL query from the agent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_query_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text text NOT NULL,
  explanation text,                          -- LLM-provided explanation of the query
  success boolean NOT NULL DEFAULT true,
  error_message text,
  row_count int,
  execution_ms int,                          -- query execution time in milliseconds
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_audit_log_user ON public.agent_query_audit_log (user_id, created_at DESC);
CREATE INDEX idx_agent_audit_log_created ON public.agent_query_audit_log (created_at DESC);

ALTER TABLE public.agent_query_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service_role and admin can read audit logs
CREATE POLICY "agent_audit_log_service" ON public.agent_query_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "agent_audit_log_insert_auth" ON public.agent_query_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Schema registry — dynamic schema for agent prompt
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_schema_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  description text,                          -- human-readable description
  columns jsonb NOT NULL DEFAULT '[]',       -- [{name, type, description}]
  is_queryable boolean NOT NULL DEFAULT true, -- allowlist flag
  display_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_schema_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_schema_select" ON public.agent_schema_registry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_schema_service" ON public.agent_schema_registry
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Populate with current schema ──

INSERT INTO public.agent_schema_registry (table_name, description, columns, display_order) VALUES

-- CRM
('crm_cards', 'Fiches CRM (prospects, clients, opportunités)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description_html","type":"TEXT"},
  {"name":"sales_status","type":"TEXT","description":"OPEN, WON, LOST, CANCELED"},
  {"name":"status_operational","type":"TEXT","description":"TODAY, WAITING"},
  {"name":"estimated_value","type":"NUMERIC"},
  {"name":"contact_email","type":"TEXT"},
  {"name":"contact_phone","type":"TEXT"},
  {"name":"column_id","type":"UUID FK→crm_columns"},
  {"name":"waiting_next_action_text","type":"TEXT"},
  {"name":"waiting_next_action_date","type":"TIMESTAMPTZ"},
  {"name":"created_at","type":"TIMESTAMPTZ"},
  {"name":"updated_at","type":"TIMESTAMPTZ"}
]'::jsonb, 1),

('crm_columns', 'Colonnes du CRM (étapes du pipeline)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"name","type":"TEXT"},
  {"name":"position","type":"INT"},
  {"name":"is_archived","type":"BOOL"}
]'::jsonb, 2),

('crm_comments', 'Commentaires sur les fiches CRM', '[
  {"name":"id","type":"UUID PK"},
  {"name":"card_id","type":"UUID FK→crm_cards"},
  {"name":"content","type":"TEXT"},
  {"name":"author_email","type":"TEXT"},
  {"name":"is_deleted","type":"BOOL"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 3),

('crm_card_emails', 'Emails envoyés depuis le CRM', '[
  {"name":"id","type":"UUID PK"},
  {"name":"card_id","type":"UUID FK→crm_cards"},
  {"name":"subject","type":"TEXT"},
  {"name":"body_html","type":"TEXT"},
  {"name":"sender_email","type":"TEXT"},
  {"name":"recipient_email","type":"TEXT"},
  {"name":"sent_at","type":"TIMESTAMPTZ"},
  {"name":"attachment_names","type":"TEXT[]"},
  {"name":"delivery_status","type":"TEXT"},
  {"name":"opened_at","type":"TIMESTAMPTZ"},
  {"name":"open_count","type":"INT"},
  {"name":"clicked_at","type":"TIMESTAMPTZ"},
  {"name":"click_count","type":"INT"}
]'::jsonb, 4),

('crm_card_tags', 'Relation tags-fiches CRM', '[
  {"name":"card_id","type":"UUID FK→crm_cards"},
  {"name":"tag_id","type":"UUID FK→crm_tags"}
]'::jsonb, 5),

('crm_tags', 'Tags CRM', '[
  {"name":"id","type":"UUID PK"},
  {"name":"name","type":"TEXT"},
  {"name":"color","type":"TEXT"}
]'::jsonb, 6),

('crm_attachments', 'Pièces jointes CRM', '[
  {"name":"id","type":"UUID PK"},
  {"name":"card_id","type":"UUID FK→crm_cards"},
  {"name":"file_name","type":"TEXT"},
  {"name":"file_path","type":"TEXT"},
  {"name":"file_size","type":"BIGINT"},
  {"name":"mime_type","type":"TEXT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 7),

('crm_revenue_targets', 'Objectifs de CA mensuels', '[
  {"name":"id","type":"UUID PK"},
  {"name":"year","type":"INT"},
  {"name":"month","type":"INT"},
  {"name":"target_amount","type":"NUMERIC"}
]'::jsonb, 8),

-- Formations
('trainings', 'Formations', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_name","type":"TEXT"},
  {"name":"client_name","type":"TEXT"},
  {"name":"location","type":"TEXT"},
  {"name":"start_date","type":"DATE"},
  {"name":"end_date","type":"DATE"},
  {"name":"format_formation","type":"TEXT","description":"intra, inter-entreprises, classe_virtuelle"},
  {"name":"prerequisites","type":"TEXT[]"},
  {"name":"program_file_url","type":"TEXT"},
  {"name":"created_at","type":"TIMESTAMPTZ"},
  {"name":"updated_at","type":"TIMESTAMPTZ"}
]'::jsonb, 10),

('training_participants', 'Participants aux formations', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"first_name","type":"TEXT"},
  {"name":"last_name","type":"TEXT"},
  {"name":"email","type":"TEXT"},
  {"name":"company","type":"TEXT"},
  {"name":"needs_survey_status","type":"TEXT","description":"non_envoye, envoye, en_cours, complete, valide_formateur, expire"},
  {"name":"added_at","type":"TIMESTAMPTZ"}
]'::jsonb, 11),

('formation_dates', 'Dates de formations disponibles', '[
  {"name":"id","type":"UUID PK"},
  {"name":"date_label","type":"TEXT"},
  {"name":"is_default","type":"BOOL"}
]'::jsonb, 12),

('training_schedules', 'Horaires des sessions de formation', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"day_date","type":"DATE"},
  {"name":"start_time","type":"TIME"},
  {"name":"end_time","type":"TIME"}
]'::jsonb, 13),

('formation_configs', 'Configurations par type de formation', '[
  {"name":"id","type":"UUID PK"},
  {"name":"formation_name","type":"TEXT UNIQUE"},
  {"name":"prix","type":"DECIMAL"},
  {"name":"duree_heures","type":"INT"},
  {"name":"programme_url","type":"TEXT"}
]'::jsonb, 14),

-- Évaluations
('evaluation_analyses', 'Analyses des évaluations de formation', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"strengths","type":"JSONB"},
  {"name":"weaknesses","type":"JSONB"},
  {"name":"recommendations","type":"JSONB"},
  {"name":"summary","type":"TEXT"},
  {"name":"evaluations_count","type":"INT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 15),

('questionnaire_besoins', 'Questionnaires de besoins participants', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"participant_id","type":"UUID FK→training_participants"},
  {"name":"experience_details","type":"TEXT"},
  {"name":"competences_actuelles","type":"TEXT"},
  {"name":"competences_visees","type":"TEXT"},
  {"name":"besoins_accessibilite","type":"TEXT"},
  {"name":"commentaires_libres","type":"TEXT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 16),

-- Missions
('missions', 'Missions de consulting', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"client_name","type":"TEXT"},
  {"name":"client_contact","type":"TEXT"},
  {"name":"status","type":"TEXT","description":"not_started, in_progress, completed, cancelled"},
  {"name":"tags","type":"TEXT[]"},
  {"name":"start_date","type":"DATE"},
  {"name":"end_date","type":"DATE"},
  {"name":"daily_rate","type":"NUMERIC"},
  {"name":"total_days","type":"NUMERIC"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 20),

('mission_activities', 'Activités facturables des missions', '[
  {"name":"id","type":"UUID PK"},
  {"name":"mission_id","type":"UUID FK→missions"},
  {"name":"activity_date","type":"DATE"},
  {"name":"duration","type":"DECIMAL"},
  {"name":"duration_type","type":"TEXT","description":"hours, days"},
  {"name":"description","type":"TEXT"},
  {"name":"billable_amount","type":"DECIMAL"},
  {"name":"is_billed","type":"BOOL"}
]'::jsonb, 21),

('mission_pages', 'Pages de documentation des missions', '[
  {"name":"id","type":"UUID PK"},
  {"name":"mission_id","type":"UUID FK→missions"},
  {"name":"title","type":"TEXT"},
  {"name":"content","type":"TEXT"}
]'::jsonb, 22),

-- Devis
('quotes', 'Devis commerciaux', '[
  {"name":"id","type":"UUID PK"},
  {"name":"quote_number","type":"TEXT"},
  {"name":"crm_card_id","type":"UUID FK→crm_cards"},
  {"name":"status","type":"TEXT","description":"draft, generated, sent, signed, expired, canceled"},
  {"name":"synthesis","type":"TEXT"},
  {"name":"instructions","type":"TEXT"},
  {"name":"email_subject","type":"TEXT"},
  {"name":"email_body","type":"TEXT"},
  {"name":"client_company","type":"TEXT"},
  {"name":"client_address","type":"TEXT"},
  {"name":"total_ht","type":"NUMERIC"},
  {"name":"total_ttc","type":"NUMERIC"},
  {"name":"line_items","type":"JSONB"},
  {"name":"pdf_path","type":"TEXT"},
  {"name":"email_sent_at","type":"TIMESTAMPTZ"},
  {"name":"created_at","type":"TIMESTAMPTZ"},
  {"name":"updated_at","type":"TIMESTAMPTZ"}
]'::jsonb, 30),

('activity_logs', 'Journal d''activités (devis, micro-devis)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"action_type","type":"TEXT"},
  {"name":"recipient_email","type":"TEXT"},
  {"name":"details","type":"JSONB","description":"Pour micro_devis_sent: formation_name, client_name, nb_participants, type_subrogation"},
  {"name":"user_id","type":"UUID"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 31),

-- Emails
('inbound_emails', 'Emails entrants', '[
  {"name":"id","type":"UUID PK"},
  {"name":"subject","type":"TEXT"},
  {"name":"text_body","type":"TEXT"},
  {"name":"html_body","type":"TEXT"},
  {"name":"from_email","type":"TEXT"},
  {"name":"from_name","type":"TEXT"},
  {"name":"to_email","type":"TEXT"},
  {"name":"notes","type":"TEXT"},
  {"name":"status","type":"TEXT","description":"received, processed, archived, spam"},
  {"name":"received_at","type":"TIMESTAMPTZ"}
]'::jsonb, 40),

('email_templates', 'Modèles d''emails', '[
  {"name":"id","type":"UUID PK"},
  {"name":"template_type","type":"TEXT"},
  {"name":"template_name","type":"TEXT"},
  {"name":"subject","type":"TEXT"},
  {"name":"html_content","type":"TEXT"},
  {"name":"is_default","type":"BOOL"}
]'::jsonb, 41),

-- Support
('support_tickets', 'Tickets de support', '[
  {"name":"id","type":"UUID PK"},
  {"name":"ticket_number","type":"TEXT"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"resolution_notes","type":"TEXT"},
  {"name":"type","type":"TEXT","description":"bug, evolution"},
  {"name":"priority","type":"TEXT"},
  {"name":"status","type":"TEXT","description":"nouveau, en_cours, en_attente, resolu, ferme"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 50),

-- Coaching
('coaching_bookings', 'Réservations de coaching', '[
  {"name":"id","type":"UUID PK"},
  {"name":"participant_id","type":"UUID FK→training_participants"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"status","type":"TEXT"},
  {"name":"instructor_notes","type":"TEXT"},
  {"name":"learner_notes","type":"TEXT"},
  {"name":"requested_date","type":"TIMESTAMPTZ"}
]'::jsonb, 60),

('coaching_summaries', 'Comptes-rendus de coaching', '[
  {"name":"id","type":"UUID PK"},
  {"name":"booking_id","type":"UUID FK→coaching_bookings"},
  {"name":"participant_id","type":"UUID FK→training_participants"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"summary_text","type":"TEXT"},
  {"name":"key_topics","type":"JSONB"},
  {"name":"action_items","type":"JSONB"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 61),

-- Contenu
('content_cards', 'Cartes éditoriales', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"column_id","type":"UUID FK→content_columns"},
  {"name":"tags","type":"JSONB"},
  {"name":"display_order","type":"INT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 70),

('content_columns', 'Colonnes du board éditorial', '[
  {"name":"id","type":"UUID PK"},
  {"name":"name","type":"TEXT"},
  {"name":"display_order","type":"INT"}
]'::jsonb, 71),

-- OKR
('okr_objectives', 'Objectifs OKR', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"time_target","type":"TEXT","description":"Q1, Q2, Q3, Q4, S1, S2, annual"},
  {"name":"target_year","type":"INT"},
  {"name":"status","type":"TEXT","description":"draft, active, completed, cancelled"},
  {"name":"progress_percentage","type":"INT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 80),

('okr_key_results', 'Résultats clés OKR', '[
  {"name":"id","type":"UUID PK"},
  {"name":"objective_id","type":"UUID FK→okr_objectives"},
  {"name":"title","type":"TEXT"},
  {"name":"target_value","type":"NUMERIC"},
  {"name":"current_value","type":"NUMERIC"},
  {"name":"unit","type":"TEXT"}
]'::jsonb, 81),

('okr_initiatives', 'Initiatives OKR', '[
  {"name":"id","type":"UUID PK"},
  {"name":"key_result_id","type":"UUID FK→okr_key_results"},
  {"name":"title","type":"TEXT"},
  {"name":"status","type":"TEXT"},
  {"name":"due_date","type":"DATE"}
]'::jsonb, 82),

-- E-learning
('lms_courses', 'Cours e-learning', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"status","type":"TEXT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 90),

('lms_modules', 'Modules e-learning', '[
  {"name":"id","type":"UUID PK"},
  {"name":"course_id","type":"UUID FK→lms_courses"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"position","type":"INT"}
]'::jsonb, 91),

('lms_lessons', 'Leçons e-learning', '[
  {"name":"id","type":"UUID PK"},
  {"name":"module_id","type":"UUID FK→lms_modules"},
  {"name":"title","type":"TEXT"},
  {"name":"lesson_type","type":"TEXT"},
  {"name":"content_html","type":"TEXT"},
  {"name":"video_url","type":"TEXT"},
  {"name":"position","type":"INT"},
  {"name":"is_mandatory","type":"BOOL"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 92),

-- Statistiques
('daily_action_analytics', 'Statistiques des actions quotidiennes', '[
  {"name":"id","type":"UUID PK"},
  {"name":"user_id","type":"UUID FK→auth.users"},
  {"name":"action_date","type":"DATE"},
  {"name":"total_actions","type":"INT"},
  {"name":"completed_count","type":"INT"},
  {"name":"auto_completed_count","type":"INT"},
  {"name":"manual_completed_count","type":"INT"},
  {"name":"category_stats","type":"JSONB"}
]'::jsonb, 95),

-- Événements
('events', 'Événements', '[
  {"name":"id","type":"UUID PK"},
  {"name":"title","type":"TEXT"},
  {"name":"description","type":"TEXT"},
  {"name":"event_date","type":"DATE"},
  {"name":"event_time","type":"TIME"},
  {"name":"location","type":"TEXT"},
  {"name":"location_type","type":"TEXT","description":"physical, visio"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 96)

ON CONFLICT (table_name) DO NOTHING;

-- ============================================================
-- 3. Helper: build schema prompt from registry
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agent_schema_prompt()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT string_agg(
    table_name || ' (' ||
    (SELECT string_agg(
      col->>'name' || ' ' || col->>'type' ||
      CASE WHEN col->>'description' IS NOT NULL
        THEN ' [' || col->>'description' || ']'
        ELSE ''
      END,
      ', '
    ) FROM jsonb_array_elements(columns) AS col) ||
    ')' ||
    CASE WHEN description IS NOT NULL THEN '  -- ' || description ELSE '' END,
    E'\n'
    ORDER BY display_order, table_name
  )
  FROM public.agent_schema_registry
  WHERE is_queryable = true;
$$;

-- ============================================================
-- 4. Helper: get allowed table names
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agent_allowed_tables()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT array_agg(table_name)
  FROM public.agent_schema_registry
  WHERE is_queryable = true;
$$;

-- ============================================================
-- 5. Updated agent_sql_query with allowlist + audit logging
-- ============================================================
CREATE OR REPLACE FUNCTION public.agent_sql_query(
  query_text text,
  p_user_id uuid DEFAULT NULL,
  p_explanation text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  normalized text;
  clean_query text;
  allowed_tables text[];
  extracted_tables text[];
  t text;
  row_cnt int;
  start_ts timestamptz;
  elapsed_ms int;
BEGIN
  start_ts := clock_timestamp();

  -- Strip trailing semicolons and whitespace
  clean_query := regexp_replace(trim(query_text), ';\s*$', '');
  -- Normalize: trim and lowercase for validation
  normalized := lower(clean_query);

  -- Only allow SELECT statements
  IF NOT (normalized LIKE 'select%' OR normalized LIKE 'with%') THEN
    -- Log failed attempt
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Only SELECT queries are allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords (word boundaries to avoid matching column names like updated_at)
  IF normalized ~ '\m(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute)\M' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Write operations are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Write operations are not allowed';
  END IF;

  -- Block multiple statements
  IF clean_query ~ ';' THEN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, 'Multiple statements are not allowed',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
    RAISE EXCEPTION 'Multiple statements are not allowed';
  END IF;

  -- ── Table allowlist check ──
  allowed_tables := public.get_agent_allowed_tables();

  -- Extract table names referenced after FROM and JOIN keywords
  SELECT array_agg(DISTINCT m[1]) INTO extracted_tables
  FROM regexp_matches(normalized, '(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)', 'g') AS m;

  IF extracted_tables IS NOT NULL THEN
    FOREACH t IN ARRAY extracted_tables LOOP
      IF NOT (t = ANY(allowed_tables)) THEN
        INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
        VALUES (p_user_id, query_text, p_explanation, false, format('Table not allowed: %s', t),
                EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
        RAISE EXCEPTION 'Access denied: table "%" is not in the allowed list', t;
      END IF;
    END LOOP;
  END IF;

  -- Execute in read-only mode with a row limit
  SET LOCAL transaction_read_only = true;
  EXECUTE format('SELECT jsonb_agg(row_to_json(sub)) FROM (SELECT * FROM (%s) _inner LIMIT 100) sub', clean_query) INTO result;

  result := COALESCE(result, '[]'::jsonb);

  -- Count rows for audit
  row_cnt := jsonb_array_length(result);
  elapsed_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int;

  -- Log successful query
  INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, row_count, execution_ms)
  VALUES (p_user_id, query_text, p_explanation, true, row_cnt, elapsed_ms);

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Log error (unless already logged above via explicit INSERT)
  BEGIN
    INSERT INTO public.agent_query_audit_log (user_id, query_text, explanation, success, error_message, execution_ms)
    VALUES (p_user_id, query_text, p_explanation, false, SQLERRM,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - start_ts)::int);
  EXCEPTION WHEN OTHERS THEN
    -- Avoid recursive failure if logging itself fails
    NULL;
  END;
  RAISE;
END;
$$;
