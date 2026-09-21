#!/usr/bin/env bash
# check-demo-mask.sh — Regle [062] : aucun ecran interne ne doit afficher une
# donnee identifiante sans passer par le mode demo (src/lib/demoMask.ts).
#
# Usage:
#   bash scripts/check-demo-mask.sh            # liste les violations (exit 1 si > 0)
#   bash scripts/check-demo-mask.sh --count    # nombre de violations (pour le ratchet)
#   bash scripts/check-demo-mask.sh --files    # violations regroupees par fichier
#
# Perimetre : ecrans internes (staff) uniquement. Les ecrans publics affichent
# les donnees de leur propre visiteur : rien a masquer, ils sont exclus.
#
# Echappatoire : ajouter `// demo-safe: <raison>` sur la ligne concernee.

set -uo pipefail

cd "$(dirname "$0")/.."

# Champs identifiants : identite, contact, entreprise, argent.
FIELDS='email|emails|contact_email|recipient_email|phone|telephone|mobile|first_name|last_name|full_name|contact_name|nom|prenom|company|company_name|societe|siret|siren|address|adresse|postal_code|iban|amount|montant|price|prix|sold_price_ht|estimated_value|total_ht|total_ttc'

# Ecrans publics / apprenant / partenaire : hors perimetre du mode demo.
PUBLIC_SCREENS='src/pages/(Landing|Auth|Signup|Onboarding|ResetPassword|ForcePasswordChange|PolitiqueConfidentialite|Connexion.*|CompteSansAcces|NotFound|Academy.*|FormulaireRedirect|Google.*Callback|LearnerPortal|LmsCoursePlayer|LmsCourseHomePage|Questionnaire|Evaluation|SponsorEvaluation|TrainerEvaluation|Emargement|Signature.*|ReclamationPublic|PartnerPortal|TrainingSummary|TrainingSupportPage|MissionSummary|SurveyPublic|TrainingSurveyResponse|BookPublicPage|SupertiltConfirmationEnvoi)\.tsx|src/components/(learner|questionnaire|ui)/'

violations() {
  grep -rnE "\{[^}]*\.($FIELDS)\b" src/pages src/components --include='*.tsx' 2>/dev/null \
    | grep -vE '\.test\.tsx:' \
    | grep -vE "$PUBLIC_SCREENS" \
    | grep -v 'demo-safe:' \
    | grep -v 'mask[A-Z]' \
    | grep -v 'isDemoMode' \
    | grep -vE '(value|defaultValue|placeholder|checked)=\{' \
    | grep -vE 'onChange|onValueChange|onSelect|onInput'
}

case "${1:-}" in
  --count)
    violations | wc -l | tr -d ' '
    ;;
  --files)
    violations | cut -d: -f1 | sort | uniq -c | sort -rn
    ;;
  *)
    out=$(violations)
    if [ -n "$out" ]; then
      echo "$out"
      echo ""
      echo "$(echo "$out" | wc -l | tr -d ' ') violation(s) : donnee identifiante affichee sans masque demo."
      echo "Corriger avec isDemoMode + mask*() (src/lib/demoMask.ts), ou justifier avec // demo-safe: <raison>."
      exit 1
    fi
    echo "OK — aucun affichage identifiant non masque dans les ecrans internes."
    ;;
esac
