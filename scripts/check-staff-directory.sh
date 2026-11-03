#!/usr/bin/env bash
# [076] Lecture d'annuaire sur profiles : la table n'est lisible qu'en admin
# (ou sur sa propre ligne). Une liste de collaborateurs passe par la RPC
# get_staff_directory. Compte les .from("profiles") de src/ sans filtre sur
# une ligne (.eq("user_id"|"id")) ni .update( dans les 4 lignes qui suivent.
# Exclu : UserAccessManager.tsx (écran réservé aux admins).
# --count : affiche le nombre ; sinon liste les occurrences.
set -u
list=$(grep -rln '\.from("profiles")' src --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v '\.test\.' | grep -v 'settings/UserAccessManager.tsx' \
  | while read -r f; do
      awk -v f="$f" '
        { line[NR]=$0 }
        END {
          for (i=1; i<=NR; i++) if (line[i] ~ /\.from\("profiles"\)/) {
            w=""; for (j=i; j<=i+4 && j<=NR; j++) w=w line[j];
            if (w !~ /\.eq\("(user_id|id)"/ && w !~ /\.update\(/) print f ":" i;
          }
        }' "$f"
    done)
if [ "${1:-}" = "--count" ]; then
  [ -z "$list" ] && echo 0 || echo "$list" | wc -l
else
  echo "$list"
fi
