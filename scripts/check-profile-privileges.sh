#!/usr/bin/env bash
# check-profile-privileges.sh — Garde-fou de la règle [063]
#
# Trois invariants, un par ligne de sortie en cas de violation (vide = OK) :
#  1. le trigger trg_guard_profile_privileges existe : la dernière migration
#     qui le nomme le crée (un DROP seul le retirerait en silence) ;
#  2. la dernière définition de public.upsert_profile refuse d'écrire le
#     profil d'un autre utilisateur ("p_user_id <> auth.uid()") ;
#  3. aucune edge function ne prend l'existence d'une ligne profiles pour une
#     preuve de staff : un apprenant a une ligne profiles. La garde passe par
#     requireStaff / isStaffUser (_shared/cron-auth.ts).
#
# Angle mort du point 3 : le motif cherche un `.from("profiles")` suivi, dans
# les 8 lignes, d'un test de la variable lue (`if (!profile)`, `if (profile)`),
# lui-même suivi dans les 8 lignes d'un refus (401/403, Forbidden,
# Unauthorized) ou d'un marqueur isStaff. Une garde écrite autrement (autre nom
# de variable, `.single()` qui lève, test déporté dans un helper) ne se voit pas.
#
# Usage: bash scripts/check-profile-privileges.sh

set -uo pipefail

MIG=supabase/migrations

last_trigger=$(grep -l "trg_guard_profile_privileges" "$MIG"/*.sql 2>/dev/null | sort | tail -1)
if [ -z "$last_trigger" ] || ! grep -qiE "CREATE TRIGGER[[:space:]]+trg_guard_profile_privileges" "$last_trigger"; then
  echo "VIOLATION [063]: trigger trg_guard_profile_privileges absent (dernière migration qui le nomme : ${last_trigger:-aucune})"
fi

last_upsert=$(grep -liE "FUNCTION[[:space:]]+public\.upsert_profile[[:space:]]*\(" "$MIG"/*.sql 2>/dev/null | sort | tail -1)
if [ -z "$last_upsert" ]; then
  echo "VIOLATION [063]: aucune définition de public.upsert_profile"
else
  body=$(awk '
    tolower($0) ~ /function[ \t]+public\.upsert_profile[ \t]*\(/ { on = 1; buf = "" }
    on { buf = buf "\n" $0; if ($0 ~ /^\$\$;|^\$function\$;/) { last = buf; on = 0 } }
    END { print last }
  ' "$last_upsert")
  if ! printf '%s' "$body" | grep -q "p_user_id <> auth.uid()"; then
    echo "VIOLATION [063]: $last_upsert redéfinit upsert_profile sans 'p_user_id <> auth.uid()'"
  fi
fi

for f in supabase/functions/*/index.ts; do
  awk -v file="$f" '
    /\.from\(["\x27]profiles["\x27]\)/ { window = 8; next }
    window > 0 {
      window--
      if ($0 ~ /if \(!?[A-Za-z_]*[pP]rofile[A-Za-z_]*\)/) { hit = FNR; tail = 8 }
    }
    tail > 0 {
      if ($0 ~ /40[13]|Forbidden|Unauthorized|isStaff/) {
        print "VIOLATION [063]: " file ":" hit " — ligne profiles utilisée comme garde staff (utiliser requireStaff / isStaffUser)"
        tail = 0; window = 0; next
      }
      tail--
    }
  ' "$f"
done
