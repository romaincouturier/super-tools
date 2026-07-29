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
#   Les extensions pg_net et pg_cron ne sont pas nécessaires : elles n'existent
#   pas hors Supabase et les migrations qui les appellent sont ignorées.
set -u

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
