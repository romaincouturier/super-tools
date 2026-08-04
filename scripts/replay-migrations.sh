#!/usr/bin/env bash
# replay-migrations.sh — Rejoue tout l'historique des migrations sur une base
# PostgreSQL locale, comme le fait `supabase db start` dans le job CI « RLS tests ».
#
# Sert à reproduire en quelques secondes, sans Docker, ce que le CI met deux
# minutes à découvrir : une migration qui ne s'applique plus sur une base vierge.
#
# Usage:
#   bash scripts/replay-migrations.sh            # s'arrête à la première erreur
#   bash scripts/replay-migrations.sh --all      # continue et liste tout
#   bash scripts/replay-migrations.sh --all --test   # + tests pgTAP
#
# Prérequis (Debian/Ubuntu) :
#   sudo apt-get install postgresql-16 postgresql-16-pgvector postgresql-16-pgtap
#   pg_net et pg_cron n'existent pas hors Supabase : le script installe des
#   doublures minimales. cron.unschedule ET cron.alter_job lèvent sur un job
#   inconnu, comme les vrais : sans ça le banc rend un faux vert sur une
#   migration qui référence un jobid de production (constaté le 03/08/2026,
#   CI rouge alors que le rejeu local annonçait 0 échec).
set -u

EXTDIR=$(pg_config --sharedir 2>/dev/null)/extension
install_stub() {
  local name="$1" body="$2"
  [ -f "$EXTDIR/$name.control" ] && return 0
  sudo -n tee "$EXTDIR/$name.control" >/dev/null <<CTL
comment = 'doublure $name pour le rejeu local des migrations'
default_version = '1.0'
relocatable = false
schema = 'extensions'
CTL
  echo "$body" | sudo -n tee "$EXTDIR/$name--1.0.sql" >/dev/null
}

install_stub pg_net "CREATE SCHEMA IF NOT EXISTS net;
CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds integer DEFAULT 5000)
RETURNS bigint LANGUAGE sql AS \$\$ SELECT 1::bigint \$\$;"

install_stub pg_cron "CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (jobid bigserial PRIMARY KEY, schedule text, command text, jobname text, active boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS cron.job_run_details (jobid bigint, runid bigserial PRIMARY KEY, job_pid integer, database text, username text, command text, status text, return_message text, start_time timestamptz, end_time timestamptz);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS \$\$ INSERT INTO cron.job(schedule, command, jobname) VALUES (\$2,\$3,\$1) RETURNING jobid \$\$;
CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS \$\$ INSERT INTO cron.job(schedule, command) VALUES (\$1,\$2) RETURNING jobid \$\$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE plpgsql AS \$fn\$
DECLARE n int;
BEGIN
  DELETE FROM cron.job WHERE jobname = job_name;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'could not find valid entry for job ''%''', job_name; END IF;
  RETURN true;
END \$fn\$;
CREATE OR REPLACE FUNCTION cron.alter_job(job_id bigint, schedule text DEFAULT NULL, command text DEFAULT NULL, database text DEFAULT NULL, username text DEFAULT NULL, active boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS \$\$
BEGIN
  UPDATE cron.job j SET schedule = coalesce(alter_job.schedule, j.schedule) WHERE j.jobid = alter_job.job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % does not exist or you don''t own it', job_id;
  END IF;
END \$\$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint)
RETURNS boolean LANGUAGE plpgsql AS \$\$
BEGIN
  DELETE FROM cron.job WHERE jobid = job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % does not exist or you don''t own it', job_id;
  END IF;
  RETURN true;
END \$\$;"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BOOTSTRAP="$REPO/scripts/replay-bootstrap.sql"
DB=${REPLAY_DB:-replay}
CONTINUE=false
RUN_TESTS=false
for arg in "$@"; do
  [ "$arg" = "--all" ] && CONTINUE=true
  [ "$arg" = "--test" ] && RUN_TESTS=true
done

psql_as_postgres() { sudo -n -u postgres "$@"; }

psql_as_postgres dropdb --if-exists "$DB"
psql_as_postgres createdb "$DB"
# Comme chez Supabase : les extensions vivent dans le schéma `extensions` mais
# restent appelables sans préfixe (gen_random_uuid, vector...).
psql_as_postgres psql -q -c "ALTER DATABASE \"$DB\" SET search_path TO public, extensions;"
if ! psql_as_postgres psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$BOOTSTRAP" >/dev/null; then
  echo "Échec du squelette Supabase ($BOOTSTRAP)"
  exit 1
fi

fail=0
for f in "$REPO"/supabase/migrations/*.sql; do
  out=$(psql_as_postgres psql -q -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -f "$f" 2>&1 >/dev/null \
        | grep -v "^NOTICE:\|^HINT:\|NOTICE:")
  if echo "$out" | grep -q "ERROR"; then
    echo "=== $(basename "$f")"
    echo "$out" | grep -E "ERROR|DETAIL" | head -3
    fail=$((fail + 1))
    [ "$CONTINUE" = "true" ] || exit 1
  fi
done

echo "----"
echo "migrations en échec : $fail"

if [ "$RUN_TESTS" = "true" ]; then
  echo ""
  for t in "$REPO"/supabase/tests/*.test.sql; do
    echo "=== $(basename "$t")"
    psql_as_postgres psql -q -d "$DB" -f "$t" 2>&1 | grep -E "^ *(ok|not ok)"
  done
fi

[ "$fail" -eq 0 ] || exit 1
