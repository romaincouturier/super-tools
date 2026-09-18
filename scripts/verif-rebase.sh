#!/usr/bin/env bash
# verif-rebase.sh — Garde-fou de la règle [060]
#
# Un rebase peut perdre une suppression de fichier sans qu'aucun contrôle ne le
# voie : le fichier revient, il compile toujours, plus personne ne l'importe, et
# ni typecheck ni tests ni lint ne rougissent. Relire le diff ne suffit pas non
# plus, la ligne perdue n'y apparaît pas.
#
# Ce script compare l'inventaire des fichiers d'avant rebase à celui d'après, et
# distingue ce que la branche a perdu de ce que la base a légitimement apporté.
#
# Usage : bash scripts/verif-rebase.sh [ref-avant-rebase] [base]
#   ref-avant-rebase : ORIG_HEAD par défaut, posé par git rebase
#   base             : origin/main par défaut
#
# Sortie : une ligne par anomalie. Vide = aucune perte. Code 1 si anomalie.

set -euo pipefail

AVANT="${1:-ORIG_HEAD}"
BASE="${2:-origin/main}"

git rev-parse --verify --quiet "$AVANT" >/dev/null || {
  echo "verif-rebase : référence d'avant rebase introuvable ($AVANT)." >&2
  echo "Passez-la en argument : bash scripts/verif-rebase.sh <sha>" >&2
  exit 2
}

SOCLE=$(git merge-base "$AVANT" "$BASE")

avant=$(mktemp); apres=$(mktemp); socle=$(mktemp)
trap 'rm -f "$avant" "$apres" "$socle"' EXIT

git ls-tree -r --name-only "$AVANT" | sort > "$avant"
git ls-files | sort > "$apres"
git ls-tree -r --name-only "$SOCLE" | sort > "$socle"

anomalies=0

# 1. Un fichier que la branche avait et qui a disparu.
while read -r f; do
  [ -n "$f" ] || continue
  echo "PERTE [060] : $f était présent avant le rebase, il a disparu"
  anomalies=$((anomalies + 1))
done < <(comm -23 "$avant" "$apres")

# 2. Un fichier que la branche avait supprimé et qui est revenu.
#    Supprimé par la branche = présent dans le socle commun, absent d'avant.
while read -r f; do
  [ -n "$f" ] || continue
  grep -qxF "$f" "$socle" || continue   # absent du socle : apport de la base, légitime
  echo "RETOUR [060] : $f avait été supprimé par la branche, il est revenu"
  anomalies=$((anomalies + 1))
done < <(comm -13 "$avant" "$apres")

# 3. La branche supprime un fichier sur lequel la base vient de travailler.
#    Ce n'est pas une erreur de rebase, c'est un désaccord d'intention : la base
#    corrige ce que la branche retire. Git ne signale rien, le diff non plus.
while read -r f; do
  [ -n "$f" ] || continue
  git diff --name-only "$SOCLE".."$BASE" -- "$f" | grep -qxF "$f" || continue
  echo "COLLISION [060] : la branche supprime $f, que $BASE a modifié depuis le socle"
  anomalies=$((anomalies + 1))
done < <(git diff --diff-filter=D --name-only "$BASE"...HEAD)

if [ "$anomalies" -gt 0 ]; then
  echo
  echo "$anomalies anomalie(s). Aucune ne se voit au diff, au typecheck ni aux"
  echo "tests. PERTE et RETOUR se rétablissent. COLLISION se tranche : la base"
  echo "travaille sur un fichier que la branche retire, il faut décider lequel"
  echo "des deux gagne, et le dire dans la PR."
  exit 1
fi
