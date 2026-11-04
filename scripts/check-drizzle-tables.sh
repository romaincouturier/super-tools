#!/usr/bin/env bash
# check-drizzle-tables.sh — Règle [077] : une table que Lovable ne crée que dans
# drizzle/migrations n'existe pas au rejeu de supabase/migrations (CI « RLS tests »,
# scripts/replay-migrations.sh). Toute migration de supabase/migrations qui la
# nomme doit conditionner ce code à son existence : to_regclass('public.<table>').
# Sortie vide = OK. Toute ligne émise est une violation (interprétée par check-rules.sh).
# Angle mort : le contrôle vérifie la présence du garde dans le fichier, pas qu'il
# entoure chaque instruction qui touche la table.
set -euo pipefail
cd "$(dirname "$0")/.."

created_in() {
  for f in "$@"; do
    sed 's/--.*//' "$f" \
      | grep -ioE '\bcreate table (if not exists )?(public\.)?[a-z_][a-z0-9_]*' \
      | sed -E 's/.* //; s/public\.//I' \
      || true
  done | tr 'A-Z' 'a-z' | sort -u
}

supabase_tables=$(created_in supabase/migrations/*.sql)
drizzle_tables=$(created_in drizzle/migrations/*.sql)
drizzle_only=$(comm -23 <(echo "$drizzle_tables") <(echo "$supabase_tables"))

for t in $drizzle_only; do
  for f in $(grep -lwE "$t" supabase/migrations/*.sql 2>/dev/null || true); do
    grep -qiE "to_regclass\('public\.$t'\)" "$f" \
      || echo "VIOLATION: $f touche '$t', créée seulement dans drizzle/migrations, sans garde to_regclass('public.$t') : le rejeu de supabase/migrations échouera"
  done
done
exit 0
