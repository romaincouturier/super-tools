#!/usr/bin/env bash
# check-backup-tables.sh — Règle [038] : toute table créée par une migration
# doit figurer dans TABLES_TO_BACKUP de backup-export ET scheduled-backup,
# sauf exclusion documentée dans scripts/backup-exclusions.txt.
# Sortie vide = OK. Toute ligne émise est une violation (interprétée par check-rules.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

EXPORT_FN="supabase/functions/backup-export/index.ts"
SCHEDULED_FN="supabase/functions/scheduled-backup/index.ts"
EXCLUSIONS="scripts/backup-exclusions.txt"

# Tables existantes : rejoue les CREATE/DROP TABLE dans l'ordre des migrations
# (gère les tables supprimées puis restaurées, ex. mission_email_drafts).
existing=$(
  for f in supabase/migrations/*.sql; do
    sed 's/--.*//' "$f" \
      | grep -ioE '\b(create|drop) table (if (not )?exists )?(only )?(public\.)?[a-z_][a-z0-9_]*' \
      | sed -E 's/if (not )?exists //I; s/only //I; s/public\.//I' \
      || true
  done | awk '
    tolower($1)=="create" { t[$3]=1 }
    tolower($1)=="drop"   { delete t[$3] }
    END { for (n in t) print n }
  ' | sort
)

list_tables() {
  sed -n '/const TABLES_TO_BACKUP = \[/,/\];/p' "$1" | grep -oE '"[a-z_][a-z0-9_]*"' | tr -d '"' | sort -u
}

export_list=$(list_tables "$EXPORT_FN")
scheduled_list=$(list_tables "$SCHEDULED_FN")
excluded=$(grep -vE '^[[:space:]]*(#|$)' "$EXCLUSIONS" 2>/dev/null | sort -u || true)

# 1. Les deux fonctions de backup doivent avoir la même liste.
if [ "$export_list" != "$scheduled_list" ]; then
  echo "VIOLATION: TABLES_TO_BACKUP diverge entre backup-export et scheduled-backup :"
  diff <(echo "$export_list") <(echo "$scheduled_list") | grep '^[<>]' | head -10 || true
fi

# 2. Toute table migrée doit être backupée ou exclue explicitement.
for t in $existing; do
  echo "$excluded" | grep -qx "$t" && continue
  echo "$export_list" | grep -qx "$t" \
    || echo "VIOLATION: table '$t' créée en migration mais absente de TABLES_TO_BACKUP — l'ajouter dans $EXPORT_FN ET $SCHEDULED_FN, ou l'exclure dans $EXCLUSIONS"
done

# 3. Une table ne peut pas être à la fois exclue et backupée (incohérence).
for t in $excluded; do
  echo "$export_list" | grep -qx "$t" \
    && echo "VIOLATION: '$t' est dans $EXCLUSIONS mais aussi dans TABLES_TO_BACKUP — retirer l'un des deux"
  echo "$existing" | grep -qx "$t" \
    || echo "VIOLATION: exclusion '$t' ne correspond à aucune table existante — nettoyer $EXCLUSIONS"
done

# ── Buckets storage ─────────────────────────────────────────────────────────
# Buckets connus : INSERT/UPDATE storage.buckets dans les migrations (preuve
# d'existence) + storage.from("...") dans le code (preuve d'usage).
BUCKET_EXCLUSIONS="scripts/backup-bucket-exclusions.txt"

known_buckets=$(
  {
    for f in supabase/migrations/*.sql; do
      tr '\n' ' ' < "$f" | grep -ioE '(insert into|update) storage\.buckets[^;]*' || true
    done | grep -oE "'[a-z0-9][a-z0-9-]*'" | tr -d "'"
    grep -rhoE 'storage[[:space:]]*\.from\("[a-z0-9][a-z0-9-]*"\)' src supabase/functions 2>/dev/null \
      | grep -oE '"[a-z0-9-]+"' | tr -d '"' || true
  } | grep '[a-z]' | sort -u
)

bucket_list=$(sed -n '/const STORAGE_BUCKETS = \[/,/\];/p' "$SCHEDULED_FN" | grep -oE '"[a-z0-9-]+"' | tr -d '"' | sort -u)
bucket_excluded=$(grep -vE '^[[:space:]]*(#|$)' "$BUCKET_EXCLUSIONS" 2>/dev/null | sort -u || true)

# 4. Tout bucket connu doit être backupé ou exclu explicitement.
for b in $known_buckets; do
  echo "$bucket_excluded" | grep -qx "$b" && continue
  echo "$bucket_list" | grep -qx "$b" \
    || echo "VIOLATION: bucket '$b' utilisé (migrations ou code) mais absent de STORAGE_BUCKETS ($SCHEDULED_FN) — l'ajouter ou l'exclure dans $BUCKET_EXCLUSIONS"
done

# 5. Exclusions de buckets mortes ou contradictoires.
for b in $bucket_excluded; do
  echo "$bucket_list" | grep -qx "$b" \
    && echo "VIOLATION: '$b' est dans $BUCKET_EXCLUSIONS mais aussi dans STORAGE_BUCKETS — retirer l'un des deux"
  echo "$known_buckets" | grep -qx "$b" \
    || echo "VIOLATION: exclusion '$b' ne correspond à aucun bucket connu — nettoyer $BUCKET_EXCLUSIONS"
done
exit 0
