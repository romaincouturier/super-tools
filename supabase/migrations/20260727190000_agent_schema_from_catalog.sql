-- Agent — le prompt de schéma est désormais GÉNÉRÉ depuis le catalogue
-- PostgreSQL au lieu d'être recopié à la main dans agent_schema_registry.
--
-- Constat : le registre déclarait 44 tables et, sur ces 44, il manquait
-- 422 colonnes ajoutées à la base après la rédaction initiale (missions :
-- 12 colonnes déclarées sur 34 réelles, dont waiting_next_action_date que
-- l'agent affirmait donc ne pas exister). Une liste écrite à la main ne peut
-- pas suivre une base de 232 tables.
--
-- Le registre garde ce qui a de la valeur humaine :
--   - is_queryable : quelles tables l'agent a le droit d'interroger
--   - description  : à quoi sert la table
--   - hidden_columns : colonnes masquées (secrets, PII)
--   - columns : conservé UNIQUEMENT pour les descriptions de colonnes,
--     qui enrichissent la sortie quand elles existent
-- Les noms et types de colonnes viennent du catalogue, donc l'écart ne peut
-- plus se recréer.
--
-- Performance : une seule passe sur pg_attribute filtrée au schéma public
-- (quelques millisecondes), fonction STABLE, et le résultat est déjà mis en
-- cache 5 minutes côté edge function.

CREATE OR REPLACE FUNCTION public.get_agent_schema_prompt()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  WITH catalog_cols AS (
    SELECT
      c.relname::text AS table_name,
      a.attname::text AS column_name,
      format_type(a.atttypid, a.atttypmod) AS data_type,
      a.attnum
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND a.attnum > 0
      AND NOT a.attisdropped
      -- Plomberie sans valeur analytique : isolation multi-tenant et
      -- colonnes non sélectionnables (vecteurs, index plein texte, binaire).
      AND a.attname <> 'org_id'
      AND format_type(a.atttypid, a.atttypmod) NOT IN ('tsvector', 'bytea')
      AND format_type(a.atttypid, a.atttypmod) NOT LIKE 'vector%'
  ),
  reg AS (
    SELECT
      r.table_name,
      r.description,
      r.display_order,
      COALESCE(r.hidden_columns, '{}'::text[]) AS hidden_columns,
      COALESCE(r.columns, '[]'::jsonb) AS columns
    FROM public.agent_schema_registry r
    WHERE r.is_queryable = true
  ),
  annotated AS (
    SELECT
      reg.table_name,
      reg.description,
      reg.display_order,
      cc.attnum,
      cc.column_name || ' ' || cc.data_type
        || COALESCE(
             ' [' || (
               SELECT e.value->>'description'
               FROM jsonb_array_elements(reg.columns) AS e(value)
               WHERE e.value->>'name' = cc.column_name
                 AND NULLIF(e.value->>'description', '') IS NOT NULL
               LIMIT 1
             ) || ']',
             ''
           ) AS col_text
    FROM reg
    JOIN catalog_cols cc ON cc.table_name = reg.table_name
    WHERE NOT (cc.column_name = ANY (reg.hidden_columns))
  ),
  per_table AS (
    SELECT
      table_name,
      description,
      display_order,
      string_agg(col_text, ', ' ORDER BY attnum) AS cols
    FROM annotated
    GROUP BY table_name, description, display_order
  )
  SELECT string_agg(
    table_name || ' (' || cols || ')'
      || CASE WHEN description IS NOT NULL THEN '  -- ' || description ELSE '' END,
    E'\n' ORDER BY display_order, table_name
  )
  FROM per_table;
$$;

COMMENT ON FUNCTION public.get_agent_schema_prompt() IS
  'Prompt de schéma de l''agent. Colonnes et types générés depuis pg_catalog ; '
  'le registre ne fournit que l''allowlist, les descriptions et les colonnes masquées.';
