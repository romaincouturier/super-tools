# Catalogue des Edge Functions Supabase

> **67 edge functions** — 45 appelées depuis le frontend, 22 backend-only (cron/webhooks)

---

## Formation / Training (13 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `generate-convention-formation` | Frontend | `{ trainingId, participantId?, subrogation? }` | `{ success, pdfUrl, documentId, fileName }` |
| `send-convention-email` | Frontend | `{ trainingId, conventionUrl, recipientEmail, recipientName? }` | `{ success }` |
| `send-convention-reminder` | Frontend | `{ trainingId, participantId }` | `{ success }` |
| `send-training-documents` | Frontend | `{ trainingId, participantId?, trainingName? }` | `{ success }` |
| `send-thank-you-email` | Frontend | `{ trainingId, participantId? }` | `{ success }` |
| `generate-certificates` | Frontend | `{ trainingId, participantIds? }` | `{ success }` |
| `send-welcome-email` | Frontend | `{ participantId, trainingId }` | `{ success }` |
| `generate-woocommerce-coupon` | Frontend | `{ participantId, trainingId }` | `{ couponCode }` |
| `send-elearning-access` | Frontend | `{ participantId, trainingId, couponCode? }` | `{ success }` |
| `send-needs-survey` | Frontend | `{ participantId, trainingId }` | `{ success }` |
| `send-needs-survey-reminder` | Frontend | `{ participantId, trainingId }` | `{ success }` |
| `summarize-needs-survey` | Frontend | `{ trainingId }` | `{ summary }` |
| `send-training-calendar-invite` | Frontend | `{ trainingId, trainingName, ... }` | `{ success }` |

**Appelées depuis :** `services/formations.ts`, `hooks/useParticipantActions.ts`, `components/formations/ParticipantList.tsx`, `components/formations/DocumentsManager.tsx`, `components/formations/AddParticipantDialog.tsx`, `components/formations/BulkAddParticipantsDialog.tsx`, `pages/FormationCreate.tsx`

---

## Signature & Documents (6 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `submit-convention-signature` | Public page | `{ token, signatureData, onLine }` | `{ success }` |
| `submit-devis-signature` | Public page | `{ token, signatureData, onLine }` | `{ success }` |
| `submit-attendance-signature` | Public page | `{ token, signatureData, onLine }` | `{ success }` |
| `verify-convention-signature` | Frontend | `{ signatureId }` | `{ valid, details }` |
| `refresh-convention-pdf-url` | Public page | `{ token }` | `{ pdfUrl }` |
| `generate-attendance-pdf` | Frontend | `{ trainingId, participantId? }` | `{ pdfUrl }` |

**Appelées depuis :** `pages/SignatureConvention.tsx`, `pages/SignatureDevis.tsx`, `pages/Emargement.tsx`, `components/formations/DocumentsManager.tsx`, `components/formations/AttendanceSignatureBlock.tsx`

---

## CRM & Ventes (5 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `crm-ai-assist` | Frontend | `{ action: "analyze_exchanges" \| "generate_quote_description" \| "improve_email_subject" \| "improve_email_body" \| "suggest_next_action", card_data }` | `{ result: string }` |
| `crm-send-email` | Frontend | `{ card_id, recipient_email, subject, body_html }` | `{ success, message? }` |
| `crm-extract-opportunity` | Frontend | `{ raw_input }` | `OpportunityExtraction` |
| `search-siren` | Frontend | `{ siren }` | `{ company_name, address, ... }` |
| `generate-micro-devis` | Frontend | `{ nomClient, adresseClient, ... }` | `{ pdfUrl }` |

**Appelées depuis :** `services/crm-ai.ts`, `hooks/useCrmBoard.ts`, `hooks/useMicroDevisForm.ts`

---

## Contenu & Collaboration (5 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `ai-content-assist` | Frontend | `{ action, content }` | `{ result }` |
| `search-content-ideas` | Frontend | `{ query }` | `{ ideas[] }` |
| `send-content-notification` | Frontend | `{ type: "mention" \| "review_requested" \| "review_reminder", recipientEmail, ... }` | `{ success }` |
| `create-review-image-upload-url` | Frontend | `{ originalFileName, mimeType, reviewId, fileBase64 }` | `{ uploadUrl }` |
| `extract-objectives-from-pdf` | Frontend | `{ pdfUrl, extractType: "prerequisites" \| "objectives" }` | `{ items[] }` |

**Appelées depuis :** `components/content/ContentCardDialog.tsx`, `components/content/AiAssistPanel.tsx`, `components/content/AiIdeasSearch.tsx`, `components/content/CommentThread.tsx`, `components/content/ReviewRequestDialog.tsx`, `components/formations/ProgramSelector.tsx`, `components/formations/ObjectivesEditor.tsx`

---

## Authentification & Sécurité (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `check-login-attempt` | Frontend | `{ email }` | `{ allowed, waitSeconds? }` |
| `log-login-attempt` | Frontend | `{ email, success }` | `{ logged }` |
| `send-password-reset` | Frontend | `{ email, redirectUrl }` | `{ success }` |

**Appelées depuis :** `hooks/useLoginAttempts.ts`, `components/ForgotPasswordDialog.tsx`

---

## Évaluations (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `analyze-evaluations` | Frontend | `{ trainingId \| null }` | `{ analysis }` |
| `process-evaluation-submission` | Frontend | `{ evaluationId }` | `{ success }` |
| `send-certificate-email` | Frontend | `{ evaluationId, recipientEmail, recipientName }` | `{ success }` |

**Appelées depuis :** `pages/Evaluations.tsx`, `pages/Evaluation.tsx`, `hooks/useParticipantActions.ts`, `components/formations/ParticipantList.tsx`

---

## Questionnaires (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `send-questionnaire-confirmation` | Public page | `{ questionnaireId, trainingId, participantEmail }` | `{ success }` |
| `send-prerequis-warning` | Public page | `{ questionnaireId, participantEmail }` | `{ success }` |
| `send-accessibility-needs` | Public page | `{ questionnaireId, trainingId }` | `{ success }` |

**Appelées depuis :** `pages/Questionnaire.tsx`

---

## Utilisateurs & Onboarding (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `onboard-collaborator` | Frontend | `{ email, firstName, lastName, modules[] }` | `{ success, userId }` |
| `send-event-share-email` | Frontend | `{ event_id, recipient_email }` | `{ success }` |
| `improve-email-content` | Frontend | `{ templateType, templateName }` | `{ improved_content }` |

**Appelées depuis :** `components/OnboardCollaboratorDialog.tsx`, `components/events/ShareEventDialog.tsx`, `data/email-templates.ts`

---

## Chatbot & Missions (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `chatbot-query` | Frontend | `{ question }` | `{ answer }` |
| `generate-mission-summary` | Frontend | `{ action: "summarize_page" \| "summarize_mission", mission_id, page_id? }` | `{ summary }` |
| `force-send-scheduled-email` | Frontend | `{ scheduledEmailId }` | `{ success }` |

**Appelées depuis :** `components/chatbot/ChatbotWidget.tsx`, `components/missions/MissionPages.tsx`, `components/missions/MissionDetailDrawer.tsx`, `components/formations/ScheduledEmailsSummary.tsx`

---

## Backup & Monitoring (3 fonctions)

| Fonction | Déclencheur | Paramètres | Retour |
|----------|------------|------------|--------|
| `backup-export` | Frontend | `{ uploadToGDrive, userId? }` | `{ backupData \| gdriveUrl }` |
| `backup-import` | Frontend | `{ backupData, dryRun }` | `{ success, stats }` |
| `check-functions-health` | Frontend | `{ headers: { Authorization } }` | `{ statuses[] }` |

**Appelées depuis :** `components/settings/BackupManager.tsx`, `components/monitoring/EdgeFunctionsTab.tsx`

---

## Backend-only (22 fonctions — cron, webhooks, internes)

| Fonction | Type | Description |
|----------|------|-------------|
| `arena-orchestrate` | Interne | Orchestration Arena AI |
| `arena-orchestrator` | Interne | Orchestrateur Arena |
| `arena-suggest-experts` | Interne | Suggestions d'experts Arena |
| `check-convention-status` | Cron | Vérifie les statuts de convention |
| `process-action-reminders` | Cron | Envoie les rappels d'actions |
| `process-crm-reminders` | Cron | Envoie les rappels CRM |
| `process-logistics-reminders` | Cron | Envoie les rappels logistiques |
| `process-mission-testimonials` | Cron | Traite les témoignages mission |
| `process-participant-list-reminders` | Cron | Rappels liste de participants |
| `process-scheduled-emails` | Cron | Envoie les emails programmés |
| `create-program-upload-url` | Interne | Génère URL d'upload pour programmes |
| `google-calendar-events` | OAuth | Intégration Google Calendar |
| `google-drive-auth` | OAuth | Authentification Google Drive |
| `record-db-size` | Cron | Enregistre la taille de la BDD |
| `resend-inbound-webhook` | Webhook | Webhook Resend (emails entrants) |
| `retry-failed-email` | Interne | Relance les emails échoués |
| `send-action-reminder` | Cron | Rappel d'action individuel |
| `send-booking-reminder` | Cron | Rappel de réservation |
| `send-evaluation-reminder` | Cron | Rappel d'évaluation |
| `send-devis-signature-request` | Interne | Envoie la demande de signature devis |
| `send-attendance-signature-request` | Interne | Envoie la demande de signature émargement |
| `verify-attendance-signature` | Interne | Vérifie signature émargement |
| `verify-devis-signature` | Interne | Vérifie signature devis |
| `zapier-create-training` | Webhook | Création formation via Zapier |

---

## Architecture

```
supabase/functions/
├── _shared/          # Code partagé (auth, email, pdf helpers)
├── [function-name]/
│   └── index.ts      # Point d'entrée Deno
```

**Invocation côté client :** `supabase.functions.invoke("function-name", { body: { ... } })`

**Service wrappers existants :**
- `src/services/formations.ts` — wraps 6 formation functions
- `src/services/crm-ai.ts` — wraps 5 CRM AI functions
- Autres : appels directs depuis hooks/composants
