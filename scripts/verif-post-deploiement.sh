#!/usr/bin/env bash
# Vérification après mise en production de la refonte de connexion.
#
# Ce que ce script couvre : la chaîne nouvelle n'a jamais tourné ailleurs qu'en
# test. Il l'exerce pour de vrai, contre l'environnement déployé, et rend un
# verdict en quelques secondes. Il ne crée rien, n'envoie aucun email, ne touche
# à aucun compte : il n'utilise que des valeurs volontairement fausses.
#
# Usage :
#   VITE_SUPABASE_URL=https://xxx.supabase.co \
#   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... \
#   bash scripts/verif-post-deploiement.sh
#
# Les deux valeurs se lisent dans les variables d'environnement du projet, ou
# dans la console Supabase, section API.

set -uo pipefail

URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}"
KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_ANON_KEY:-}}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Il manque l'adresse du projet ou la clé publique."
  echo "  VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... bash $0"
  exit 2
fi

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[0;33m'; OFF='\033[0m'
echecs=0
alertes=0

ok()    { printf "${GREEN}OK${OFF}      %s\n" "$1"; }
ko()    { printf "${RED}ECHEC${OFF}   %s\n" "$1"; printf "        %s\n" "$2"; echecs=$((echecs+1)); }
alerte(){ printf "${YEL}ALERTE${OFF}  %s\n" "$1"; printf "        %s\n" "$2"; alertes=$((alertes+1)); }

appel_fonction() { # $1 nom, $2 corps json
  curl -s -m 15 -X POST "$URL/functions/v1/$1" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" \
    -H "Content-Type: application/json" -d "$2" 2>/dev/null
}

appel_rpc() { # $1 nom, $2 corps json -> code http + corps
  curl -s -m 15 -o /tmp/rpc-corps.txt -w "%{http_code}" -X POST "$URL/rest/v1/rpc/$1" \
    -H "Authorization: Bearer $KEY" -H "apikey: $KEY" \
    -H "Content-Type: application/json" -d "$2" 2>/dev/null
}

echo ""
echo "Vérification de la connexion apprenant sur $URL"
echo ""

# 1. Le service d'aiguillage répond, et la base derrière lui fonctionne.
rep=$(appel_fonction resolve-login-identity '{"email":"verification-deploiement@exemple-inexistant.fr"}')
if echo "$rep" | grep -q '"state"'; then
  if echo "$rep" | grep -q '"unknown"'; then
    ok "L'aiguillage répond, et il ne connaît pas une adresse inventée."
  else
    alerte "L'aiguillage répond, mais pas ce qui était attendu." "Réponse : $rep"
  fi
else
  ko "L'aiguillage ne répond pas." \
     "La page de connexion basculera en mode dégradé : personne n'est bloqué, mais l'aiguillage par adresse ne marche pas. Réponse : ${rep:-aucune}"
fi

# 2. L'ouverture de lien répond, et refuse un jeton inventé.
rep=$(appel_fonction redeem-learner-token '{"token":"jeton-de-verification-inexistant"}')
if echo "$rep" | grep -q '"status"'; then
  if echo "$rep" | grep -q '"invalid"'; then
    ok "L'ouverture de lien répond, et refuse un jeton inventé."
  else
    alerte "L'ouverture de lien répond autre chose qu'un refus." "Réponse : $rep"
  fi
else
  ko "L'ouverture de lien ne répond pas." \
     "C'est le cœur du nouveau parcours : aucun lien reçu par email ne connectera. Réponse : ${rep:-aucune}"
fi

# 3. Le bandeau d'information est lisible sans compte.
code=$(appel_rpc get_app_setting_public '{"p_key":"maintenance_banner_enabled"}')
if [ "$code" = "200" ]; then
  ok "Le réglage du bandeau se lit sans compte (valeur : $(cat /tmp/rpc-corps.txt))."
else
  alerte "Le réglage du bandeau ne se lit pas (code $code)." \
         "Le bandeau restera invisible. Sans gravité pour la connexion."
fi

# 4. Les données d'un apprenant ne se lisent pas sans compte. Doit échouer.
code=$(appel_rpc get_learner_portal_data '{"p_email":"verification@exemple-inexistant.fr"}')
if [ "$code" = "200" ]; then
  ko "Les données du portail se lisent SANS COMPTE." \
     "La fermeture de sécurité n'est pas en place. À traiter avant toute communication aux apprenants."
elif [ "$code" = "000" ]; then
  # Un serveur injoignable refuse aussi : ce n'est pas une preuve de fermeture.
  alerte "Impossible de joindre le serveur pour vérifier la fermeture du portail." \
         "Contrôle non concluant, à refaire une fois le serveur joignable."
else
  ok "Les données du portail refusent un appel sans compte (code $code)."
fi

# 5. L'envoi de lien répond. Adresse inventée : aucun email ne part.
rep=$(appel_fonction send-learner-magic-link '{"email":"verification-deploiement@exemple-inexistant.fr","purpose":"login"}')
if echo "$rep" | grep -q '"success"'; then
  ok "L'envoi de lien répond."
else
  ko "L'envoi de lien ne répond pas." \
     "Un apprenant sans mot de passe ne pourra pas entrer. Réponse : ${rep:-aucune}"
fi

echo ""
if [ "$echecs" -gt 0 ]; then
  printf "${RED}%s point(s) bloquant(s), %s alerte(s).${OFF}\n" "$echecs" "$alertes"
  echo "Ne pas communiquer aux apprenants. Republier la version précédente si un apprenant est bloqué."
  exit 1
fi
if [ "$alertes" -gt 0 ]; then
  printf "${YEL}Aucun point bloquant, %s alerte(s) à regarder.${OFF}\n" "$alertes"
  exit 0
fi
printf "${GREEN}Tout répond. Enchaîner sur docs/RECETTE_FONCTIONNELLE.md, bloc 1.${OFF}\n"
