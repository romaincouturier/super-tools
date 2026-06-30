# Audit d'observabilité — modèle C4

Date : 2026-06-30. Objectif : identifier où placer de l'observabilité (capture
d'erreurs, logs, alerting) en parcourant le système par niveaux C4
(Contexte → Conteneurs → Composants), puis prioriser les actions.

Méthode : relecture du code (front `src/`, 224 edge functions Deno, migrations
SQL + intégrations). Citations en `fichier:ligne` quand pertinent.

---

## Niveau 1 — Contexte

Système : SaaS e-learning + back-office SuperTilt.

- Acteurs : staff (authentifié JWT), apprenants (rôle anon + header `x-learner-email`), systèmes externes via webhooks.
- Systèmes externes dépendants : Resend (email), Stripe (paiement), WooCommerce, Signitic (signatures email), Fireflies / AssemblyAI (transcription), Google (auth/calendar/drive/routes), Pennylane (facturation), Slack, Pictodico, WP-Statistics, SIREN/INSEE, passerelle IA (Lovable/Gemini).

Aux frontières du système, l'observabilité existe **partiellement** :
- Sentry est branché côté front (`src/lib/sentry.ts`, `@sentry/react`) et côté edge (`supabase/functions/_shared/sentry.ts`, `reportEdgeError`).
- Plusieurs tables d'audit/log existent déjà (emails, webhooks, login, indexation, agent SQL).

Le problème n'est pas l'absence d'outillage mais sa **couverture inégale**.

---

## Niveau 2 — Conteneurs (état + lacunes)

| Conteneur | Outillage présent | Lacune principale | Sévérité |
|-----------|-------------------|-------------------|----------|
| Frontend SPA | Sentry (prod), 2 ErrorBoundary, tracking de routes | Pas de capture globale react-query ; pas de `Sentry.setUser` | Élevée |
| Edge Functions (Deno) | `reportEdgeError` dispo | ~27/224 fonctions instrumentées (~12 %) ; TIER 1 majoritairement aveugle | Élevée |
| Base Postgres | `monitor_cron_failures`, tables d'audit | Crons HTTP ne valident pas la réponse de l'edge function | Moyenne |
| Systèmes externes | Resend + WooCommerce bien tracés | Fireflies/AssemblyAI/Stripe/Pennylane/Slack peu ou pas tracés | Moyenne |

---

## Niveau 3 — Composants et constats

### 3.1 Frontend SPA

Points forts :
- `RouteErrorBoundary.tsx:38` appelle `Sentry.captureException` (gère aussi les erreurs de chunk de déploiement).
- `src/lib/sentry.ts` : filtrage du bruit (ResizeObserver, extensions, bots), init prod-only depuis l'app_setting `sentry_dsn`.
- Tracking de navigation via `PageViewTracker.tsx` (vers `trackFeature`, pas Sentry).

Lacunes :
1. **Pas de capture globale react-query** (P0). `App.tsx:128` crée le `QueryClient` sans `QueryCache`/`MutationCache` `onError`. Conséquence : toute erreur de requête/mutation (refus RLS, RPC en échec, 500 d'edge function appelée côté client) ne remonte qu'en toast local et n'atteint jamais Sentry.
2. **`toastError` n'envoie rien à Sentry** (`src/lib/toastError.ts`). C'est pourtant la principale surface d'erreur de l'app (40+ appels). Erreur affichée puis perdue.
3. **Pas de contexte utilisateur** (P1). Aucun `Sentry.setUser` / `setTag` (rôle staff/apprenant, email). Les erreurs n'ont ni « qui » ni « quel module ».
4. **`functions.invoke(...).catch(() => {})`** silencieux à plusieurs endroits (ex. `useQuestionnaire.ts`, `useIdeas.ts`). Échec d'effet de bord totalement muet.
5. Performance volontairement désactivée (`tracesSampleRate: 0`, plan gratuit) — acceptable, à documenter.

### 3.2 Edge Functions (Deno)

Couverture : ~27 fonctions sur 224 appellent `reportEdgeError`. ~197 ne reportent rien (console.error au mieux).

TIER 1 (forte valeur — argent / légal / irréversible / cron) non instrumenté :
- **Signatures (conformité eIDAS)** : `submit-attendance-signature`, `verify-attendance-signature`, `submit-location-signature` ne reportent pas. Risque : signature marquée « signée » même si la génération de preuve ou la notification échoue.
- **Webhooks entrants** : `assemblyai-webhook`, `fireflies-webhook`, `pictodico-webhook` — erreurs aval avalées (`.catch(() => {})`), `console.warn` non remonté en alerte.
- **Crons / batchs** : famille `process-*-reminders`, `poll-*`, `scheduled-backup`, `archive-resolved-tickets`. Les échecs d'un item dans une boucle restent invisibles : la fonction renvoie HTTP 200 avec `{ sent: 15, failed: 2 }` sans dire **quels** items ni **pourquoi**.
- **Envois d'email métier** : la cinquantaine de `send-*` (rappels, convocations, livrables) ne reportent pas individuellement (le filet de sécurité est la table `failed_emails`, pas Sentry).

TIER 2 (génération IA, uploads) : `generate-*`, `analyze-*`, `transcribe-*`, `summarize-*`, ~23 `upload-*` — non instrumentés.

TIER 3 (lecture, proxys, `search-*`) : criticité faible.

Monitoring existant et ses trous :
- `check-functions-health` : présence (déployée/absente) via sonde, pas la latence ni le taux d'erreur.
- `monitor-indexation-health` : âge de la file, pas le motif d'échec par item.
- `record-db-size` / `db_size_snapshots` : taille seulement.
- `business-health-score` : KPI métier (dépend de la passerelle IA).
- `alert-form-error` : erreurs de formulaire côté client uniquement.

### 3.3 Base Postgres

Points forts :
- `monitor_cron_failures()` (quotidien) lit `cron.job_run_details` et alerte si un job a échoué.
- Triggers sans avalement silencieux dangereux : le trigger d'indexation capture les échecs `pg_net` mais garantit l'insertion en file (bon pattern).
- Tables d'audit présentes : `login_attempts`, `sent_emails_log`, `failed_emails`, `scheduled_emails`, `crm_scheduled_emails`, `indexation_queue`, `agent_query_audit_log`, `crm_activity_log`, `webhook_logs`, `db_size_snapshots`.

Lacunes :
1. **Crons HTTP non vérifiés** (P1). ~12 jobs pg_cron font un `net.http_post` vers une edge function sans contrôler le code de réponse. Si l'edge function renvoie 500/timeout, le job paraît « succeeded » dans `cron.job_run_details` → `monitor_cron_failures` ne voit rien. Jobs concernés notables : `process-indexation-queue` (toutes les 2 min, pipeline RAG), `process-session-start` (toutes les 15 min), `generate-daily-actions`, `process-daily-summary`, `cleanup-pending-email-drafts`, `process-live-upcoming-notifications`.
2. Pas de table de log des appels API externes (voir 3.4).

### 3.4 Systèmes externes

| Système | Erreurs reportées | Log dédié | Constat |
|---------|-------------------|-----------|---------|
| Resend (email) | Oui (`failed_emails` + retry 429) | `sent_emails_log` / `failed_emails` | Bon ; manque le suivi des bounces (webhook Resend non branché) et un vrai retry programmé |
| WooCommerce | Oui (`reportEdgeError` + `webhook_logs`) | `webhook_logs` | Bon |
| Stripe | Oui (`reportEdgeError`) | Aucune table | Signature vérifiée ; pas de trace persistée |
| Signitic | Fallback silencieux | Aucun | Dégradation gracieuse mais invisible |
| Fireflies | Non (console only) | `transcripts` | Échecs GraphQL muets |
| AssemblyAI | Non | `transcripts` | Pas de `reportEdgeError` |
| Pennylane | Non (remonte au front) | Aucun | Aucune trace serveur |
| Slack | Échec non fatal non loggé | Aucun | Acceptable (fire-and-forget) |

Webhooks entrants : tous vérifient une signature/secret (Stripe HMAC, Resend Svix, WooCommerce HMAC, Fireflies/AssemblyAI secret d'en-tête, CRM/Pictodico token). Manque surtout `reportEdgeError` sur Fireflies et AssemblyAI.

Pipeline email (critique) :
- `_shared/resend.ts` : `sendEmail()` journalise succès → `sent_emails_log` (Qualiopi) et échec → `failed_emails`, avec 3 retries exponentiels sur 429.
- Manques : pas de dead-letter / retry programmé au-delà du champ `status` de `scheduled_emails` ; pas de capture Sentry automatique (dépend de chaque fonction appelante) ; pas de tracking « accepté mais non délivré ».

---

## Roadmap priorisée

### P0 — Capture centrale, coût faible, valeur immédiate
1. Front : ajouter `QueryCache`/`MutationCache` `onError` au `QueryClient` (`App.tsx:128`) qui appelle `Sentry.captureException` avec le contexte (clé de requête / variables de mutation). Capture d'un coup toutes les erreurs RLS/RPC/edge côté client.
2. Front : `Sentry.setUser({ id, email, role })` une fois l'auth connue (dans l'init Sentry runtime), + `setTag("role", ...)`.

### P1 — Boucher les angles morts backend critiques
3. Ajouter `reportEdgeError(err, { fn })` aux ~23 fonctions TIER 1 sans report (signatures `submit-*`/`verify-*`, webhooks `fireflies`/`assemblyai`/`pictodico`, crons `process-*`/`poll-*`, `scheduled-backup`). ~2 lignes par fonction.
4. Remplacer les `.catch(() => {})` muets (front et edge) par un report explicite.
5. Crons : journaliser le code de réponse HTTP des `net.http_post` dans une table `cron_execution_log` et étendre `monitor_cron_failures` pour alerter sur les réponses non-2xx.

### P2 — Granularité et fiabilité
6. Boucles batch (`process-*-reminders`, `poll-*`) : renvoyer un `results[]` détaillé par item et `reportEdgeError(err, { fn, item_id })` dans le catch interne.
7. Email : cron de retry des `scheduled_emails` en échec (retry_count < 3) ; brancher le webhook Resend pour bounces/plaintes.
8. Table `external_api_call_log` (api, endpoint, status, durée, erreur) pour Fireflies/AssemblyAI/Stripe/Pennylane.

### P3 — Confort et SLA
9. `toastError` : option pour pousser les erreurs sévères vers Sentry.
10. Breadcrumbs sur les actions clés (soumission de formulaire, upload, mutation critique).
11. Étendre `check-functions-health` à la latence p95 par fonction avec seuils.

---

## Quick wins recommandés (à faire en premier)
- P0.1 + P0.2 (front) : un seul fichier touché, capture instantanément la majorité des erreurs réelles aujourd'hui invisibles.
- P1.3 (edge TIER 1) : mécanique, sans risque, déployable par lots (le pattern « lot 1/2/3 » a déjà été utilisé pour Sentry edge).
