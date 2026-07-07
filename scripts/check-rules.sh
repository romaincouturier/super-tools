#!/usr/bin/env bash
# check-rules.sh — Vérifie les règles d'IMPROVEMENTS.md
# Usage:
#   bash scripts/check-rules.sh           # Audit complet (toute la codebase)
#   bash scripts/check-rules.sh --staged  # Uniquement les fichiers staged (pre-commit)
# Exit code: 0 = OK, 1 = violations trouvées
#
# Chaque règle est définie UNE SEULE FOIS, dans l'une des trois sections :
#   1. Règles pattern     — périmètre variable : fichiers staged (--staged) ou src/ (complet)
#   2. Règles fichier fixe — cibles précises, rapides, exécutées dans les DEUX modes
#   3. Audit complet      — scans repo-wide lourds, mode complet uniquement
# Pour ajouter une règle via /learn : la placer dans la bonne section, jamais en double.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

STAGED_MODE=false
if [ "${1:-}" = "--staged" ]; then
  STAGED_MODE=true
fi

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

# grep sur le périmètre courant : fichiers staged en mode --staged, src/ sinon.
# Flags grep additionnels acceptés après le pattern (-E, -l, ...).
search_files() {
  local pattern="$1"
  shift
  if [ "$STAGED_MODE" = "true" ]; then
    echo "$STAGED_FILES" | xargs -r grep -n "$pattern" "$@" 2>/dev/null || true
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

# =========================================================
# 1. Règles pattern (périmètre : staged ou src/ selon mode)
# =========================================================

check "001" "Pas de pattern auto-save manuel (utiliser useAutoSaveForm)" \
  "search_files 'saveTimeoutRef\|pendingUpdatesRef' | grep -v 'useAutoSaveForm'"

check "003" "getFileType/resolveContentType non dupliqué" \
  "search_files 'function getFileType\|function resolveContentType\|const getFileType\|const resolveContentType' | grep -v 'src/lib/file-utils.ts'"

check "004" "Pas d'usage direct de file.type (utiliser resolveContentType)" \
  "search_files 'file\.type' | grep -v 'file-utils.ts' | grep -v 'file-utils.test.ts' | grep -v '// safe:' | grep -vi 'resolveContentType\|resolvedContentType' | grep -v '\.d\.ts'"

check "006" "Pas de refetchOnWindowFocus: true dans le code" \
  "search_files 'refetchOnWindowFocus:\s*true'"

check "007" "DialogContent/SheetContent avec w-full pour le mobile" \
  "search_files 'DialogContent\|AlertDialogContent\|SheetContent' | grep 'max-w-' | grep -v 'w-full' | grep -v 'sm:max-w-md'"

# [010] registerMediaEntry sans deleteMediaFile = fichiers orphelins potentiels
# Known pre-existing: MissionPages.tsx, CrmDescriptionEditor.tsx, useLms.ts
check "010" "registerMediaEntry doit avoir un deleteMediaFile dans le même fichier (nouveaux fichiers)" \
  "search_files 'registerMediaEntry' -l | grep -v 'MissionPages.tsx' | grep -v 'CrmDescriptionEditor.tsx' | grep -v 'useLms.ts' | grep -v 'useLmsUploads.ts' | xargs -r grep -L 'deleteMediaFile' 2>/dev/null"

# [016] React Query mutations dans deps useEffect = boucle infinie
# Heuristique : deps contenant un identifiant update/create/delete + majuscule
# (convention useUpdateXxx → updateXxx). Faux positifs possibles si callback stable (useCallback).
check "016" "Pas d'objet mutation React Query dans les deps d'un useEffect" \
  "search_files '\\], \\[[^]]*\\b(update|create|delete)[A-Z][a-zA-Z]*\\b[^]]*\\]' -E"

check "018" "Utiliser useCopyToClipboard au lieu de navigator.clipboard.writeText" \
  "search_files 'navigator\.clipboard\.writeText' | grep -v 'hooks/useCopyToClipboard.ts'"

check "019" "Utiliser toastError() au lieu de toast({title:\"Erreur...\",...destructive})" \
  "search_files 'toast\\(\\{[^}]*title:\\s*\"Erreur' -E | grep -v 'lib/toastError.ts'"

check "021" "Utiliser useConfirm() au lieu de window.confirm()" \
  "search_files 'if (confirm(' | grep -v 'hooks/useConfirm.tsx'"

check "023" "Utiliser todayAsISO() au lieu de new Date().toISOString().slice(0, 10)" \
  "search_files 'new Date().toISOString().slice(0, 10)' | grep -v 'lib/dateFormatters.ts'"

if [ "$STAGED_MODE" = "true" ]; then
  # [017] et [020] : migrations progressives — legacy restant en codebase,
  # vérifiées uniquement sur les fichiers du commit.
  check "017" "Utiliser <Spinner> au lieu de <Loader2 animate-spin>" \
    "search_files '<Loader2[^>]*animate-spin' -E | grep -v 'components/ui/spinner.tsx'"

  check "020" "Préférer useEdgeFunction() au lieu de supabase.functions.invoke() inline" \
    "echo \"\$STAGED_FILES\" | grep -v 'src/services/' | grep -v 'src/lib/' | grep -v 'src/hooks/useEdgeFunction.ts' | xargs -r grep -n 'supabase\\.functions\\.invoke' 2>/dev/null"
fi

# ==========================================================
# 2. Règles fichier fixe (cibles précises, dans les 2 modes)
# ==========================================================

check "005" "Overlays media avec will-change (pas de transition-opacity sans GPU promotion)" \
  "grep -rln 'transition-opacity' src/components/media/ --include='*.tsx' 2>/dev/null | xargs -r grep -L 'will-change' 2>/dev/null"

check "006" "QueryClient a refetchOnWindowFocus: false dans App.tsx" \
  "grep -n 'refetchOnWindowFocus:\s*false' src/App.tsx" \
  "false"

check "011" "globPatterns dans vite.config.ts ne contient pas 'js'" \
  "grep 'globPatterns' vite.config.ts | grep '\.js'"

# [026b] Les 8 edge functions d'upload critiques doivent exister et utiliser le handler partagé.
check "026b" "Les edge functions d'upload utilisent _shared/upload-handler.ts (pas de pattern inline)" \
  "for fn in upload-crm-attachment upload-support-attachment upload-trainer-document upload-training-document-field upload-participant-invoice upload-crm-image upload-participant-convention upload-participant-file; do \
     f=\"supabase/functions/\$fn/index.ts\"; \
     [ ! -f \"\$f\" ] && echo \"VIOLATION: \$f manquant\" && continue; \
     grep -q 'upload-handler' \"\$f\" || echo \"VIOLATION: \$f n'utilise pas _shared/upload-handler.ts\"; \
   done"

check "026c" "uploadSignedConvention et uploadParticipantFile passent par edge function (pas de storage direct)" \
  "f=\"src/services/participants.ts\"; \
   grep -q 'upload-participant-convention' \"\$f\" || echo \"VIOLATION: participants.ts n'invoke plus upload-participant-convention\"; \
   grep -q 'upload-participant-file' \"\$f\" || echo \"VIOLATION: participants.ts n'invoke plus upload-participant-file\"; \
   grep -q 'storage\.upload' \"\$f\" && echo \"VIOLATION: participants.ts utilise storage.upload direct\"; \
   true"

check "027" "Check admin dans useModuleAccess utilise profiles.is_admin (pas un RPC email-hardcodé)" \
  "f=\"src/hooks/useModuleAccess.ts\"; \
   grep -q 'supabase\.rpc(\"is_admin\"' \"\$f\" && echo \"VIOLATION: useModuleAccess appelle le RPC is_admin() — utiliser profiles.is_admin\"; \
   grep -q 'romain@supertilt\.fr' \"\$f\" && echo \"VIOLATION: email hardcodé dans useModuleAccess\"; \
   true"

check "030a" "ChatbotProvider n'utilise pas isAuthenticated (doit vérifier user_metadata.role)" \
  "grep -n 'isAuthenticated\|setIsAuthenticated' src/components/chatbot/ChatbotProvider.tsx"

check "030b" "rag-chatbot bloque les apprenants (403 si role=learner)" \
  "grep -n 'learner' supabase/functions/rag-chatbot/index.ts" \
  "false"

check "030c" "chatbot-query bloque les apprenants (403 si role=learner)" \
  "grep -n 'learner' supabase/functions/chatbot-query/index.ts" \
  "false"

check "030d" "rag-chatbot n'expose pas trainings/formation_configs/improvements" \
  "grep -n '\.from(\"trainings\"\|\.from(\"formation_configs\"\|\.from(\"improvements\"' supabase/functions/rag-chatbot/index.ts"

check "031c" "agent-chat bloque les apprenants (403 si role=learner)" \
  "grep -n 'learner' supabase/functions/agent-chat/index.ts" \
  "false"

check "031d" "notify-lms-comment a une authentification (verifyAuth)" \
  "grep -n 'verifyAuth' supabase/functions/notify-lms-comment/index.ts" \
  "false"

check "031e" "Migration staff_select_guard existe" \
  "test -f supabase/migrations/20260529100000_staff_select_guard.sql && echo 'found'" \
  "false"

# [028] Blocs LMS — tout BlockEditor doit être dans ACTIVE_CONTENT_TYPES de BuilderInsertMenu
{
  menu="src/components/lms/builder/BuilderInsertMenu.tsx"
  lms_violations=""
  for editor_file in src/components/lms/blocks/editors/*BlockEditor.tsx; do
    bname=$(basename "$editor_file" BlockEditor.tsx)
    btype=$(echo "$bname" | sed 's/\([A-Z]\)/_\1/g' | tr '[:upper:]' '[:lower:]' | sed 's/^_//')
    if ! grep -qF "\"$btype\"" "$menu" 2>/dev/null; then
      lms_violations="${lms_violations}MISSING in ACTIVE_CONTENT_TYPES: $btype\n"
    fi
  done
  if [ -n "$lms_violations" ]; then
    echo -e "${RED}FAIL${NC} [028] Tout BlockEditor LMS doit être dans ACTIVE_CONTENT_TYPES de BuilderInsertMenu"
    printf "$lms_violations" | head -10
    violations=$((violations + 1))
  else
    echo -e "${GREEN}OK${NC}   [028] Tout BlockEditor LMS doit être dans ACTIVE_CONTENT_TYPES de BuilderInsertMenu"
  fi
  checked=$((checked + 1))
}

# [035] Liens supports/LMS dans les emails — toute fonction manipulant supports_url
# doit passer par _shared/supports-url.ts (personnalisation ?email= par destinataire).
check "035" "Les edge functions utilisant supports_url importent _shared/supports-url.ts" \
  "grep -rln 'supports_url' supabase/functions/ --include='index.ts' | xargs -r grep -L 'supports-url.ts' 2>/dev/null"

# [034] Enforcement machine — toute règle d'IMPROVEMENTS.md doit avoir un check ici.
# Whitelist : règles legacy à vérification manuelle documentée.
MANUAL_RULES="002|013|022|024|029|032|033"
check "034" "Toute règle d'IMPROVEMENTS.md a un check machine (hors whitelist manuelle)" \
  "for id in \$(grep -oE '^### \[[0-9]{3}\]' IMPROVEMENTS.md | tr -d '#[] '); do \
     echo \"\$id\" | grep -qE '^($MANUAL_RULES)\$' && continue; \
     grep -q \"check \\\"\$id\" scripts/check-rules.sh || grep -qF \"[\$id]\" scripts/check-rules.sh || echo \"VIOLATION: règle [\$id] sans check machine dans check-rules.sh\"; \
   done"

# ====================================================
# 3. Audit complet uniquement (scans repo-wide lourds)
# ====================================================

if [ "$STAGED_MODE" = "false" ]; then

  # [008] CORS centralisé — toutes les fonctions doivent importer depuis _shared/cors.ts
  check "008" "Pas de CORS headers définis localement dans les edge functions" \
    "grep -rn '\"Access-Control-Allow-Origin\": \"\*\"' supabase/functions/ --include='*.ts' | grep -v '_shared/cors.ts' | grep -v '\.test\.ts' | grep -v node_modules"

  # [009] RLS — pas de FOR ALL TO anon USING(true) (full open access)
  # Exclude old migrations whose policies are dropped by later fix migrations
  check "009" "Pas de FOR ALL TO anon USING(true) dans les migrations" \
    "grep -rn 'FOR ALL TO anon USING (true)' supabase/migrations/ --include='*.sql' | grep -v '20260308224610' | grep -v '20260308225436'"

  # [014] Pas d'accès données direct dans les pages agent-chat
  check "014" "Pas de supabase.from() ou fetch() direct dans les pages/composants agent" \
    "grep -rn 'supabase\.from\|\.fetch(' src/components/agent* src/pages/Agent* --include='*.tsx' 2>/dev/null | grep -v 'use[A-Z].*\.ts' | grep -v node_modules | grep -v '// safe:'"

  # [014b] Nouveaux fichiers src/pages ou src/components ne doivent pas importer supabase directement
  # Whitelist: fichiers legacy connus avec accès direct (ne pas modifier sans migration complète)
  LEGACY_DIRECT_SUPABASE="Reclamations|Admin|TimeTracker|MicroDevis|FormationEdit|PictoDico|Evaluations|InboundEmails|BPFReport|FailedEmails|Dropshipping|MissionSummary|FormationDetail|Temoignages|Transcripts|LearnerPortal|SupertiltOrders|ArenaDiscussion|ArenaSetup|EventDetail|LmsCourseHomePage|LmsCommunityAdmin|CrmKanbanBoard|CardDetailDrawer|ProvenanceTab|Step5Email|Step0ClientValidation|KanbanBoard|CommentThread|TranscriptGenerationPanel|ScheduledEmailsSummary|NewOpportunityDialog|UserAccessManager|CardTranscriptsSection|LmsCommunities|Landing|FormulaireRedirect|ForcePasswordChange|ChatbotAdmin|SuperTilt|LmsCoursePlayer|AgentChat|LearnerOnboarding|BesoinsParticipants|LmsMessages|LearnerResetPassword|Auth|CertificateGenerator|PolitiqueConfidentialite|Onboarding|QuoteWorkflow|EventEdit|AdminArchives|ResetPassword|Formations|WoocommerceInbox|LmsLearners|SponsorEvaluation|PartnerPortal|MediaLibrary|Historique|Signup|TrainingSurveyResponse|Catalogue|SignatureConvention|FormationCreate|SignatureLocation|MultiUserSelector|LogisticsBookingButtons|PollingIndicator|GoogleCalendarConnect|WatchItemCard|CardDetailCommunication|CardDetailQualification|CardDetailTabs|CardDetailDialogs|CreateCalendarEventDialog|SentDevisSection|CoachCommercialSettings|CrmDescriptionEditor|CreateTrainingDialog|CronJobsTab|FeatureUsageTab|DbSizeTab|GoogleConnect|RequireStaff|Step1Synthesis|Step3QuoteGeneration|OnboardCollaboratorDialog|EntityMediaManager|MentionTextarea|AiIdeasSearch|NewsletterSection|ContentDashboard|ReviewPanel|ReviewRequestDialog|NotificationBell|UserMenu|ChatbotProvider|KnowledgeBaseManager|ChatbotWidget|CoachingBooking|LearnerMessaging|LearnerLmsMessaging|ShareEventDialog|SendToContentBoardButton|TemplateReviewReminderCard|TrainerManager|EmailSnippetManager|CrmTagManager|SettingsEmails|AgentIndexationSettings|BackupManager|ApiKeyManager|SettingsGeneral|PostEvaluationEmailManager|BillingSection|TranscriptPromptsSettings|StaffProfileSettings|MissionPages|MissionActionsManager|ImportGoogleEventsDialog|MissionDetailDrawer|GenerateInvoiceDialog|Generate8PDialog|ForumSection|LearnerCourseHeader|CourseHomeSidebar|LessonComments|TrainerSelector|BulkAddParticipantsDialog|FormationDetailSections|AssignedUserSelector|DuplicateParticipantDialog|CoachingSlotsSection|TrainerEvaluationBlock|TrainerAdequacy|TrainingFormulasManager|ObjectivesEditor|FormationDetailHeader|DuplicateTrainingDialog|ViewQuestionnaireDialog|ParticipantDocumentsDialog|TrainingNameCombobox|UserEmailCombobox|ParticipantFiles|LiveMeetingsSection|ParticipantTraceabilityDrawer|SupertiltLinkCombobox|PrerequisitesEditor|FormationDetailParticipants|EmailTimelineComputed|ThankYouEmailPreviewDialog|ProgramSelector|ParticipantEvaluationsBlock|InvoiceSection|DocumentDeliverySection|AttendanceSheetSection|SignedConventionFiles|ConventionSection|ConventionAuditPanel|BroadcastEmailDialog|GoogleDriveConnect|ForgotPasswordDialog|CatalogFormDialog|OKRAICheckInDraft|OKRAIChat"
  check "014b" "Pas de nouveau import supabase direct dans src/pages ou src/components (whitelist legacy)" \
    "grep -rln 'from.*@/integrations/supabase/client' src/pages src/components --include='*.tsx' 2>/dev/null | while read f; do name=\$(basename \"\$f\" .tsx); echo \"\$name\" | grep -qE \"^(\$LEGACY_DIRECT_SUPABASE)\$\" && continue; echo \"VIOLATION [014b]: \$f\"; done"

  # [015] Pages authentifiées doivent utiliser ModuleLayout + PageHeader
  # Exceptions : pages publiques, auth, learner, error, full-screen spécialisées
  EXEMPT_PAGES="Auth|Signup|ResetPassword|ForcePasswordChange|LearnerResetPassword|Landing|PolitiqueConfidentialite|Emargement|Evaluation|Questionnaire|TrainerEvaluation|SponsorEvaluation|ReclamationPublic|LearnerPortal|LearnerAccess|LearnerOnboarding|LearnerOnboarding.test|LmsCoursePlayer|LmsCourseHomePage|LessonBuilderPage|LmsCourseHomeBuilderPage|NotFound|FormulaireRedirect|Screenshots|AgentChat|ArenaDiscussion|ArenaSetup|ArenaResults|Dashboard|FormationDetail|MissionSummary|TrainingSummary|TrainingSupportPage|Index|Onboarding|SignatureConvention|SignatureDevis|SignatureLocation|GoogleDriveCallback|GoogleCalendarCallback|GoogleCallback|LmsCourseEntry|PartnerPortal|SurveyPublic|TrainingSurveyResponse|BookPublicPage"
  check "015" "Pages authentifiées utilisent ModuleLayout + PageHeader" \
    "for f in src/pages/*.tsx; do name=\$(basename \"\$f\" .tsx); echo \"\$name\" | grep -qE \"^(\$EXEMPT_PAGES)\$\" && continue; has_layout=\$(grep -l 'ModuleLayout' \"\$f\" 2>/dev/null | wc -l); has_header=\$(grep -l 'PageHeader' \"\$f\" 2>/dev/null | wc -l); if [ \"\$has_layout\" -eq 0 ] || [ \"\$has_header\" -eq 0 ]; then echo \"VIOLATION: \$name (ModuleLayout=\$has_layout, PageHeader=\$has_header)\"; fi; done"

  # [012] Composants UI morts (0 imports hors de leur propre fichier)
  check "012" "Pas de composants UI non importés" \
    "for f in src/components/ui/*.tsx; do name=\$(basename \"\$f\" .tsx); count=\$(grep -r \"from.*ui/\$name\" src/ --include='*.tsx' --include='*.ts' -l 2>/dev/null | grep -v \"ui/\$name.tsx\" | wc -l); [ \"\$count\" -eq 0 ] && echo \"DEAD: \$name\"; done"

  # [025] Catch-up mid-session — tout dialog d'ajout de participant doit
  # s'appuyer sur isTrainingOngoing + catchUpAttendanceSignaturesForParticipant.
  check "025" "Dialogs d'ajout de participant utilisent le catch-up mid-session" \
    "for f in src/components/formations/*AddParticipant*.tsx; do [ -f \"\$f\" ] || continue; has_hook=\$(grep -l 'useAddParticipant\\|isTrainingOngoing\\|catchUpAttendanceSignatures' \"\$f\" | wc -l); [ \"\$has_hook\" -eq 0 ] && echo \"VIOLATION: \$(basename \"\$f\") ne s'appuie pas sur le catch-up mid-session\"; done"

  # [026] Uploads — jamais de supabase.storage.upload() + supabase.from().insert/update() dans le même fichier src/
  # Le pattern dangereux est la combinaison storage.upload() + DB insert/update côté frontend :
  # il dépend des policies RLS qui peuvent être cassées par Lovable. Doit passer par une edge function.
  # Exclusions légitimes :
  #   useMedia.ts       — uploadMediaFile() et registerMediaEntry() sont des fonctions SÉPARÉES, les callers
  #                       passent par des edge functions pour l'upload avant d'appeler registerMediaEntry.
  #   useTrainingSupport.ts — upload TUS resumable (gros fichiers) dans une fn isolée, inserts dans d'autres fns.
  check "026" "Pas de storage.upload() + insert/update DB dans le même fichier src/ (passer par edge function)" \
    "for f in \$(grep -rln 'supabase\.storage\.' src/ --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v '\.spec\.' | grep -v 'useMedia\.ts' | grep -v 'useTrainingSupport\.ts'); do \
       has_upload=\$(grep -c '\.upload(' \"\$f\" 2>/dev/null || echo 0); \
       has_insert=\$(grep -cE '\.from\(.*\)\.(insert|update)\(' \"\$f\" 2>/dev/null || echo 0); \
       [ \"\$has_upload\" -gt 0 ] && [ \"\$has_insert\" -gt 0 ] && echo \"VIOLATION: \$f (storage.upload + DB insert/update direct)\"; \
     done"

  # [026d] Aucun supabase.storage.upload() direct dans src/ — DOIT passer par une edge function.
  # Exceptions légitimes :
  #   useMedia.ts          — uploadMediaFile() appelle upload-media-file (edge fn), pas storage direct
  #   useTrainingSupport.ts — bucket géré côté edge fn
  check "026d" "Aucun storage.upload() direct dans src/ (tout doit passer par une edge function)" \
    "grep -rln '\.storage\.' src/ --include='*.ts' --include='*.tsx' \
       | grep -v '\.test\.' | grep -v '\.spec\.' \
       | grep -v 'useMedia\.ts' | grep -v 'useTrainingSupport\.ts' \
       | xargs grep -l '\.upload(' 2>/dev/null \
       | while read f; do echo \"VIOLATION: \$f appelle storage.upload() directement — passer par une edge function\"; done; true"

  # [031] Isolation données apprenants — les NOUVELLES migrations (post-2026-05-29)
  # ne doivent pas introduire de nouvelles failles.
  check "031a" "Pas de FOR ALL TO authenticated USING (true) sur les tables sensibles dans les nouvelles migrations" \
    "find supabase/migrations/ -name '*.sql' -newer supabase/migrations/20260529100000_staff_select_guard.sql | xargs grep -En 'FOR ALL TO authenticated USING .true.' 2>/dev/null | grep -E 'crm_|missions|quotes|watch_|improvements|newsletters|email_templates|training_supports|coaching_summaries|agent_schema_registry'"

  check "031b" "Pas de FOR ALL TO anon USING (true) sauf formulaires token-based" \
    "grep -rn 'FOR ALL TO anon USING (true)' supabase/migrations/ | grep -v '20260308225436\|fix_rls_anon\|20260321130000\|20260308224610'"

  # Ratchet [017] / [020] — migrations progressives : la dette ne peut que descendre.
  # Baselines dans scripts/rules-ratchet.txt. Compte > baseline = violation.
  # Compte < baseline = abaisser la baseline dans le même commit.
  ratchet() {
    local rule_id="$1"
    local description="$2"
    local current="$3"
    local baseline
    baseline=$(grep "^${rule_id}=" scripts/rules-ratchet.txt | cut -d= -f2)
    checked=$((checked + 1))
    if [ -z "$baseline" ]; then
      echo -e "${RED}FAIL${NC} [$rule_id] baseline manquante dans scripts/rules-ratchet.txt"
      violations=$((violations + 1))
    elif [ "$current" -gt "$baseline" ]; then
      echo -e "${RED}FAIL${NC} [$rule_id] $description : $current occurrences (baseline: $baseline) — la dette a augmenté"
      violations=$((violations + 1))
    elif [ "$current" -lt "$baseline" ]; then
      echo -e "${GREEN}OK${NC}   [$rule_id] $description : $current/$baseline — abaisser la baseline à $current dans scripts/rules-ratchet.txt"
    else
      echo -e "${GREEN}OK${NC}   [$rule_id] $description : $current/$baseline"
    fi
  }

  count_017=$(grep -rEn '<Loader2[^>]*animate-spin' src/ --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v 'components/ui/spinner.tsx' | wc -l)
  ratchet "017" "Ratchet <Loader2 animate-spin> inline (utiliser <Spinner>)" "$count_017"

  count_020=$(grep -rn 'supabase\.functions\.invoke' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'src/services/' | grep -v 'src/lib/' | grep -v 'hooks/useEdgeFunction.ts' | wc -l)
  ratchet "020" "Ratchet supabase.functions.invoke() inline (utiliser useEdgeFunction)" "$count_020"

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
