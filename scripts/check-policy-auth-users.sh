#!/usr/bin/env bash
# check-policy-auth-users.sh — Garde-fou de la règle [044]
# Aucun CREATE POLICY des migrations récentes ne doit lire auth.users :
# le rôle `authenticated` n'a pas SELECT sur auth.users, la policy échoue en
# 403 / 42501 et l'app affiche une page vide sans erreur exploitable.
# Vérifier les droits passe par une fonction SECURITY DEFINER
# (public.is_admin, public.is_staff_user, public.has_module_access).
#
# Usage: bash scripts/check-policy-auth-users.sh [cutoff]
# Sortie : une ligne par violation (fichier:ligne). Vide = OK.

set -euo pipefail

CUTOFF="${1:-20260803000000}"

for f in supabase/migrations/*.sql; do
  base=$(basename "$f")
  [ "$base" \> "$CUTOFF" ] || continue
  awk -v file="$f" '
    BEGIN { inpolicy = 0 }
    {
      line = $0
      lower = tolower(line)
      if (inpolicy == 0 && lower ~ /create[ \t]+policy/) {
        inpolicy = 1
        start = FNR
        buf = ""
      }
      if (inpolicy == 1) {
        buf = buf " " lower
        if (line ~ /;[ \t]*$/) {
          if (buf ~ /auth\.users/) {
            print file ":" start ": VIOLATION [044] CREATE POLICY lisant auth.users"
          }
          inpolicy = 0
        }
      }
    }
  ' "$f"
done
