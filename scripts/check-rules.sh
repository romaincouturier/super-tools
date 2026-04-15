#!/usr/bin/env bash
# check-rules.sh — Vérifie les règles d'IMPROVEMENTS.md
# Usage:
#   bash scripts/check-rules.sh           # Audit complet (toute la codebase)
#   bash scripts/check-rules.sh --staged  # Uniquement les fichiers staged (pre-commit)
# Exit code: 0 = OK, 1 = violations trouvées

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

STAGED_MODE=false
if [ "${1:-}" = "--staged" ]; then
  STAGED_MODE=true
fi

# En mode staged, récupérer la liste des fichiers .ts/.tsx modifiés
STAGED_FILES=""
if [ "$STAGED_MODE" = "true" ]; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM -- '*.ts' '*.tsx' 2>/dev/null || true)
  if [ -z "$STAGED_FILES" ]; then
    echo "Aucun fichier .ts/.tsx staged — skip vérification."
    exit 0
  fi
fi

violations=0
checked=0

# grep wrapper : en mode staged, ne cherche que dans les fichiers staged
search_files() {
  local pattern="$1"
  shift
  if [ "$STAGED_MODE" = "true" ]; then
    echo "$STAGED_FILES" | xargs grep -n "$pattern" "$@" 2>/dev/null || true
  else
    grep -rn "$pattern" src/ --include='*.ts' --include='*.tsx' "$@" 2>/dev/null || true
  fi
}

check() {
  local rule_id="$1"
  local description="$2"
  local cmd="$3"
  local expect_empty="${4:-true}"

  checked=$((checked + 1))
  result=$(eval "$cmd" 2>/dev/null || true)

  if [ "$expect_empty" = "true" ]; then
    if [ -n "$result" ]; then
      echo -e "${RED}FAIL${NC} [$rule_id] $description"
      echo "$result" | head -10
      echo ""
      violations=$((violations + 1))
    else
      echo -e "${GREEN}OK${NC}   [$rule_id] $description"
    fi
  else
    if [ -z "$result" ]; then
      echo -e "${RED}FAIL${NC} [$rule_id] $description"
      violations=$((violations + 1))
    else
      echo -e "${GREEN}OK${NC}   [$rule_id] $description"
    fi
  fi
}

echo "========================================="
echo " Vérification des règles IMPROVEMENTS.md"
if [ "$STAGED_MODE" = "true" ]; then
  echo " (mode staged — fichiers du commit uniquement)"
fi
echo "========================================="
echo ""

if [ "$STAGED_MODE" = "true" ]; then
  # --- Mode staged : ne vérifie que les fichiers du commit ---

  # [001] Auto-save — ne pas réimplémenter manuellement
  check "001" "Pas de pattern auto-save manuel (utiliser useAutoSaveForm)" \
    "echo \"$STAGED_FILES\" | xargs grep -n 'saveTimeoutRef\|pendingUpdatesRef' 2>/dev/null | grep -v 'useAutoSaveForm'"

  # [003] Pas de fonctions utilitaires dupliquées
  check "003" "getFileType/resolveContentType non dupliqué" \
    "echo \"$STAGED_FILES\" | xargs grep -n 'function getFileType\|function resolveContentType\|const getFileType\|const resolveContentType' 2>/dev/null | grep -v 'src/lib/file-utils.ts'"

  # [004] Jamais file.type directement
  check "004" "Pas d'usage direct de file.type (utiliser resolveContentType)" \
    "echo \"$STAGED_FILES\" | xargs grep -n 'file\.type' 2>/dev/null | grep -v 'file-utils.ts' | grep -v 'file-utils.test.ts' | grep -v '// safe:' | grep -v 'resolveContentType'"

  # [005] Overlays hover — will-change
  STAGED_MEDIA=$(echo "$STAGED_FILES" | grep 'src/components/media/' || true)
  if [ -n "$STAGED_MEDIA" ]; then
    check "005" "Overlays media avec will-change" \
      "echo \"$STAGED_MEDIA\" | xargs grep -l 'transition-opacity' 2>/dev/null | xargs grep -L 'will-change' 2>/dev/null"
  fi

  # [006] refetchOnWindowFocus: true interdit
  check "006" "Pas de refetchOnWindowFocus: true" \
    "echo \"$STAGED_FILES\" | xargs grep -n 'refetchOnWindowFocus:\s*true' 2>/dev/null"

  # [007] DialogContent/SheetContent doivent avoir w-full pour mobile
  STAGED_TSX=$(echo "$STAGED_FILES" | grep '\.tsx$' || true)
  if [ -n "$STAGED_TSX" ]; then
    check "007" "DialogContent/SheetContent avec w-full pour le mobile" \
      "echo \"$STAGED_TSX\" | xargs grep -n 'DialogContent\|AlertDialogContent\|SheetContent' 2>/dev/null | grep 'max-w-' | grep -v 'w-full'"
  fi

  # [010] registerMediaEntry sans deleteMediaFile = fichiers orphelins potentiels
  # Known pre-existing: MissionPages.tsx, CrmDescriptionEditor.tsx, useLms.ts
  check "010" "registerMediaEntry doit avoir un deleteMediaFile dans le même fichier (nouveaux fichiers)" \
    "echo \"$STAGED_FILES\" | xargs grep -l 'registerMediaEntry' 2>/dev/null | grep -v 'MissionPages.tsx' | grep -v 'CrmDescriptionEditor.tsx' | grep -v 'useLms.ts' | xargs grep -L 'deleteMediaFile' 2>/dev/null"

  # [011] PWA — globPatterns ne doit pas contenir js (staged vite.config.ts)
  STAGED_VITE=$(echo "$STAGED_FILES" | grep 'vite.config.ts' || true)
  if [ -n "$STAGED_VITE" ]; then
    check "011" "globPatterns dans vite.config.ts ne contient pas 'js'" \
      "grep 'globPatterns' vite.config.ts | grep '\.js'"
  fi

  # [016] React Query mutations dans deps useEffect = boucle infinie
  check "016" "Pas d'objet mutation React Query dans les deps d'un useEffect" \
    "echo \"$STAGED_FILES\" | xargs grep -nE '\\], \\[[^]]*\\b(update|create|delete)[A-Z][a-zA-Z]*\\b[^]]*\\]' 2>/dev/null | grep -v node_modules"

  # [017] Spinner — ne pas écrire Loader2 animate-spin inline
  check "017" "Utiliser <Spinner> au lieu de <Loader2 animate-spin>" \
    "echo \"$STAGED_FILES\" | xargs grep -nE '<Loader2[^>]*animate-spin' 2>/dev/null | grep -v 'components/ui/spinner.tsx'"

  # [018] Copie clipboard — toujours via useCopyToClipboard
  check "018" "Utiliser useCopyToClipboard au lieu de navigator.clipboard.writeText" \
    "echo \"$STAGED_FILES\" | xargs grep -n 'navigator\\.clipboard\\.writeText' 2>/dev/null | grep -v 'hooks/useCopyToClipboard.ts'"

  # [019] Toast d'erreur — toujours via toastError()
  check "019" "Utiliser toastError() au lieu de toast({title:\"Erreur\",...destructive})" \
    "echo \"$STAGED_FILES\" | xargs grep -nE 'toast\\(\\{[^}]*title:\\s*\"Erreur\"' 2>/dev/null | grep -v 'lib/toastError.ts'"

else
  # --- Mode complet : audit de toute la codebase ---

  check "001" "Pas de pattern auto-save manuel (utiliser useAutoSaveForm)" \
    "grep -rn 'saveTimeoutRef\|pendingUpdatesRef' src/components/ src/pages/ --include='*.tsx' --include='*.ts' | grep -v 'useAutoSaveForm' | grep -v node_modules"

  check "003" "getFileType/resolveContentType non dupliqué" \
    "grep -rn 'function getFileType\|function resolveContentType\|const getFileType\|const resolveContentType' src/ --include='*.ts' --include='*.tsx' | grep -v 'src/lib/file-utils.ts' | grep -v node_modules"

  check "004" "Pas d'usage direct de file.type (utiliser resolveContentType)" \
    "grep -rn 'file\.type' src/ --include='*.ts' --include='*.tsx' | grep -v 'file-utils.ts' | grep -v 'file-utils.test.ts' | grep -v '// safe:' | grep -vi 'resolveContentType\|resolvedContentType' | grep -v node_modules | grep -v '\.d\.ts'"

  check "005" "Overlays media avec will-change (pas de transition-opacity sans GPU promotion)" \
    "grep -rln 'transition-opacity' src/components/media/ --include='*.tsx' 2>/dev/null | xargs grep -L 'will-change' 2>/dev/null"

  check "006" "Pas de refetchOnWindowFocus: true dans le code" \
    "grep -rn 'refetchOnWindowFocus:\s*true' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules"

  check "006" "QueryClient a refetchOnWindowFocus: false dans App.tsx" \
    "grep -n 'refetchOnWindowFocus:\s*false' src/App.tsx" \
    "false"

  check "007" "DialogContent/SheetContent avec w-full pour le mobile" \
    "grep -rn 'DialogContent\|AlertDialogContent\|SheetContent' src/components/ src/pages/ --include='*.tsx' | grep 'max-w-' | grep -v 'w-full' | grep -v 'sm:max-w-md' | grep -v node_modules"

  # [010] registerMediaEntry sans deleteMediaFile = fichiers orphelins potentiels
  # Known pre-existing: MissionPages.tsx, CrmDescriptionEditor.tsx, useLms.ts
  check "010" "registerMediaEntry doit avoir un deleteMediaFile dans le même fichier (nouveaux fichiers)" \
    "grep -rln 'registerMediaEntry' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'MissionPages.tsx' | grep -v 'CrmDescriptionEditor.tsx' | grep -v 'useLms.ts' | xargs grep -L 'deleteMediaFile' 2>/dev/null"

  # [008] CORS centralisé — toutes les fonctions doivent importer depuis _shared/cors.ts
  check "008" "Pas de CORS headers définis localement dans les edge functions" \
    "grep -rn '\"Access-Control-Allow-Origin\": \"\*\"' supabase/functions/ --include='*.ts' | grep -v '_shared/cors.ts' | grep -v node_modules"

  # [009] RLS — pas de FOR ALL TO anon USING(true) (full open access)
  # Exclude old migrations whose policies are dropped by later fix migrations
  check "009" "Pas de FOR ALL TO anon USING(true) dans les migrations" \
    "grep -rn 'FOR ALL TO anon USING (true)' supabase/migrations/ --include='*.sql' | grep -v '20260308224610' | grep -v '20260308225436'"

  # [011] PWA — JS chunks ne doivent pas être précachés
  check "011" "globPatterns dans vite.config.ts ne contient pas 'js'" \
    "grep 'globPatterns' vite.config.ts | grep '\.js'"

  # [014] Pas d'accès données direct dans les pages agent-chat (nouveaux modules doivent respecter la séparation)
  # Known pre-existing: nombreux composants legacy (crm, content, quotes, events, settings) — hors scope
  check "014" "Pas de supabase.from() ou fetch() direct dans les pages/composants agent" \
    "grep -rn 'supabase\.from\|\.fetch(' src/components/agent* src/pages/Agent* --include='*.tsx' 2>/dev/null | grep -v 'use[A-Z].*\.ts' | grep -v node_modules | grep -v '// safe:'"

  # [015] Pages authentifiées doivent utiliser ModuleLayout + PageHeader
  # Exceptions : pages publiques, auth, learner, error, full-screen spécialisées
  EXEMPT_PAGES="Auth|Signup|ResetPassword|ForcePasswordChange|Landing|PolitiqueConfidentialite|Emargement|Evaluation|Questionnaire|TrainerEvaluation|SponsorEvaluation|ReclamationPublic|LearnerPortal|LearnerAccess|LmsCoursePlayer|NotFound|FormulaireRedirect|Screenshots|AgentChat|ArenaDiscussion|ArenaSetup|ArenaResults|FormationDetail|MissionSummary|TrainingSummary|TrainingSupportPage|Index|Onboarding|SignatureConvention|SignatureDevis"
  check "015" "Pages authentifiées utilisent ModuleLayout + PageHeader" \
    "for f in src/pages/*.tsx; do name=\$(basename \"\$f\" .tsx); echo \"\$name\" | grep -qE \"^(\$EXEMPT_PAGES)\$\" && continue; has_layout=\$(grep -l 'ModuleLayout' \"\$f\" 2>/dev/null | wc -l); has_header=\$(grep -l 'PageHeader' \"\$f\" 2>/dev/null | wc -l); if [ \"\$has_layout\" -eq 0 ] || [ \"\$has_header\" -eq 0 ]; then echo \"VIOLATION: \$name (ModuleLayout=\$has_layout, PageHeader=\$has_header)\"; fi; done"

  # [012] Composants UI morts (0 imports hors de leur propre fichier)
  check "012" "Pas de composants UI non importés" \
    "for f in src/components/ui/*.tsx; do name=\$(basename \"\$f\" .tsx); count=\$(grep -r \"from.*ui/\$name\" src/ --include='*.tsx' --include='*.ts' -l 2>/dev/null | grep -v \"ui/\$name.tsx\" | wc -l); [ \"\$count\" -eq 0 ] && echo \"DEAD: \$name\"; done"

  # [016] React Query mutations dans deps useEffect = boucle infinie
  # Heuristique : tableau de deps contenant un identifiant commençant par update/create/delete + majuscule
  # (convention nommage useUpdateXxx → updateXxx). Faux positifs possibles si la variable est un callback
  # stable (useCallback), à vérifier manuellement.
  check "016" "Pas d'objet mutation React Query dans les deps d'un useEffect" \
    "grep -rEn '\\], \\[[^]]*\\b(update|create|delete)[A-Z][a-zA-Z]*\\b[^]]*\\]' src/ --include='*.tsx' --include='*.ts' | grep -v node_modules"

  # [018] Copie clipboard — toujours via useCopyToClipboard (full migration faite)
  check "018" "Utiliser useCopyToClipboard au lieu de navigator.clipboard.writeText" \
    "grep -rn 'navigator\\.clipboard\\.writeText' src/ --include='*.tsx' --include='*.ts' | grep -v 'hooks/useCopyToClipboard.ts'"

  # [019] Toast d'erreur — toujours via toastError() (full migration faite)
  check "019" "Utiliser toastError() au lieu de toast({title:\"Erreur\",...destructive})" \
    "grep -rEn 'toast\\(\\{[^}]*title:\\s*\"Erreur\"' src/ --include='*.tsx' --include='*.ts' | grep -v 'lib/toastError.ts'"

  # [017] : migration progressive — check en mode staged uniquement
  # (71 usages restants de <Loader2 animate-spin> avec tailles non-standard légitimes)
fi

echo ""
echo "========================================="
if [ "$violations" -gt 0 ]; then
  echo -e "${RED}$violations violation(s) trouvée(s) sur $checked vérifications${NC}"
  echo "Corrigez les violations avant de committer."
  exit 1
else
  echo -e "${GREEN}$checked/$checked vérifications OK${NC}"
  exit 0
fi
