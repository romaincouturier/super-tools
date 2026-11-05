# AGENTS.md

<!-- bmad:context -->
<!-- Verified 2026-09-24 against fea1468. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## super-tools

Système d'information de SuperTilt, organisme de formation : formations et LMS, CRM et devis, missions, contenu, support. React 18 + TypeScript + Vite + Tailwind/shadcn, Supabase (Postgres + RLS, Edge Functions Deno). Vue produit : `PRD.md`. Architecture : `docs/architecture.md`. Livrables BMAD : `_bmad-output/`.

## Politique

- Ne jamais pousser sur `main` : Lovable y pousse sans protection de branche. Travailler sur une branche, livrer par PR.
- Les règles de `IMPROVEMENTS.md` sont des invariants, pas un backlog : les consulter avant de coder une feature. `bash scripts/check-rules.sh` doit passer avant chaque commit ; corriger toute violation, ne jamais l'ignorer.
- Toute règle ajoutée à `IMPROVEMENTS.md` porte un critère de vérification concret et le check correspondant dans `scripts/check-rules.sh`.
- Un changement dans `supabase/config.toml`, `supabase/functions/`, `supabase/migrations/` ou `src/integrations/supabase/` explicite son impact sécurité dans la PR.
- Ne pas déplacer `supabase/migrations-apres-front/*` vers `supabase/migrations/` avant la publication du front : ces migrations cassent l'app en ligne. Procédure : `supabase/migrations-apres-front/README.md`.
- Ne pas éditer `_bmad/config.toml` ni `_bmad/config.user.toml` (régénérés par l'installeur BMAD) ; surcharges dans `_bmad/custom/`.

## Où sont les choses

- Routeur : `src/App.tsx`.
- Helpers partagés des Edge Functions : `supabase/functions/_shared/` (OAuth Google, MIME, Pennylane, suivi de coût API). Chercher là avant d'écrire un helper.
- Tests d'isolation RLS (pgTAP) : `supabase/tests/*.test.sql`, joués par le workflow `RLS tests` sur toute PR touchant `supabase/migrations/`.
- BMAD : point d'entrée `/bmad-help`. Orchestrateur `bmad-loop` : `.bmad-loop/policy.toml`, exige `_bmad-output/implementation-artifacts/sprint-status.yaml` (produit par `/bmad-sprint-planning`).

## Lancer et vérifier

- Typecheck : `npm run typecheck`, jamais `npx tsc --noEmit` : `tsconfig.json` est un fichier solution et cette commande compile zéro fichier.
- Avant de pousser, lancer ce que la CI lance : `npm run typecheck`, `bash scripts/check-rules.sh`, `npm test`.
- `npm test` couvre aussi `supabase/functions/_shared/**/*.test.ts` et `supabase/tests/**/*.test.ts`, pas seulement `src/`.
- npm uniquement (CI : `npm ci`, Node 20).

## Conventions qui diffèrent des défauts

- Flux de données : page -> hook (`src/hooks/`) -> service (`src/services/`) -> Supabase. Pas de `supabase.from()` ni de `fetch()` direct dans un composant UI.
- Documentation, messages de commit et textes UI en français.

## Pièges connus

- Pousser sur GitHub n'applique aucune migration à la base hébergée : seules celles créées par Lovable le sont. Une migration de `supabase/migrations/` doit être jouée explicitement.

<!-- /bmad:context -->

# Architecture rules

- CRM statistics map outcomes from sales status and use an explicit current-day snapshot boundary while replaying earlier column history; the shared dialog accepts tooltip column order, because incomplete move or closure history must not override current opportunity categories.

- Permanent-session inline Solo creation inherits catalog values through a service and hook; course availability considers both catalog and session links, because the shortcut must not invent prices or hide existing associations.

- Training tables share a pure sorting helper with per-tab sort state.
- Learner dashboard onboarding derives remaining steps from a pure profile helper and renders only a nonempty list, because completion must hide the block independently of work deposits.

- Password setup loads and saves learner names through authenticated session-owned profile access, after an explicit recovery confirmation click; it never consumes recovery tokens on page load or exposes anonymous email-based profile lookup, because name prefill must preserve scanner-safe links and identity privacy.

- Bulk participant progress follows awaited stages and per-recipient callbacks, so it reflects real work.

- Staff learner-access sends provision missing accounts only after checking an existing participant or LMS enrollment, because bulk additions bypass account provisioning and must not silently skip the email or create arbitrary accounts.
- Staff learner-access failures preserve their stage and use HTTP 429 for non-admin link quotas; only a server-verified caller checked by is_admin may bypass the internal quota, and browser batches report failed recipients without undoing enrollment, because administrator tests must not weaken public protections or duplicate participant records.

- Training document delivery locks submission before preparation, checks trainer signatures, generates certificates without sending separate emails, and uses provider idempotency per confirmation; only attached documents are marked sent, because an incomplete or repeated preparation must not send invoices alone or claim missing documents were delivered.

- Login submissions read named fields from FormData rather than React state, because browser and password-manager autofill can update inputs without firing change events.

- Participant BPF normalization stays in a pure helper local to add-training-participant and is tested against database CHECK values, because draft and normal inserts must accept legacy shop labels without writing invalid classifications.

- Watch sources canonicalize URLs with a database trigger and a matching browser helper; watch-item source links adjust counts through a database trigger, because imports and UI writes must preserve the same identity and counters.

- Course covers upload via authenticated Storage to the public LMS bucket only on save, because cancelling must not change the course.

- HTML/embed and exercise interactive HTML share an explicit HTML/CSS allowlist across MCP writes and browser rendering, render in an isolated iframe whose CSP forbids all scripts (nested srcdoc frames are script-free sandboxes, only third-party `src` players get script flags), with parent-side resize observation, because author CSS must stay isolated, no author JavaScript may run, and YouTube/Vimeo/LinkedIn players must still work.
- Interactive LMS blocks use the same viewers in learner pages and builder previews; drag words use dnd-kit with uniquely identified word instances, because touch accessibility and repeated words must behave consistently.

- Preparation-questionnaire reminder templates use `{{questionnaire_link}}` as a protected CTA placeholder, rendered server-side as an email-safe button plus fallback link, because editable templates must not inject arbitrary HTML.
- Evaluation templates must never contain Google Forms URLs; participant and sponsor links are tokenized SuperTools URLs generated at send time, because external forms bypass evaluation tracking.- Storage backup is an incremental Drive mirror resumed via `backup_storage_manifest`; `backup_runs` has separate DB/storage statuses and the no-backup alert reads `db_status` only, because a full copy exceeds one cron window.
- A shared work deposit and its community post (`practice_posts.deposit_id`) are one thread: comments and reactions are read/written on the community post tables everywhere (lesson, community, Dépôts screen, email like), because two parallel stores made staff replies invisible to learners.
- Backup tables are exported in primary-key order via the `backup_export_page` RPC, which returns a per-row hash sum; each table is re-fingerprinted live right after export. Only a gap showing rows missing from the backup and not covered by rows dated after the export marks the DB backup KO; deletions (backup is a superset), tables with no date column and failed checks are reported as warnings, because keyset export cannot duplicate rows and normal activity during the run must not fail the nightly backup.
- A game order line is out of daily alerts and shipment follow-up once it is archived, shipped (`shipped_confirmed_at`) or hand-delivered (`hand_delivered_at`); daily to-dos for order lines auto-close when the line leaves the status that created them, because status changes after the morning run otherwise left stale alerts.
- Course blocks read training dates live via read-only security-definer RPCs (`get_lms_upcoming_sessions`) returning session/venue facts only, because hardcoded dates go stale and learners lack training RLS.
- Review/testimonial requests for missions are hand-written signals in `testimonial_requests` (one per mission contact), never generated emails; `mission_email_drafts` is read-only history, because requests are now tailored by the assistant.
- LMS audio originals are copied by `archive-lms-audio` to a readable Drive tree (course / Paris date / original name), tracked in `lms_audio_archives` with catch-up per call, because storage paths are unreadable.
- The mission "Facture à émettre" flag (`missions.invoice_to_issue*`) is separate from the next action and is cleared by a DB trigger when an activity gets an invoice number, because every invoicing path (UI, Pennylane, MCP) must clear it without client code.
- LMS course audio transcripts live on their `media` row (`transcript`, `transcription_status` pending/transcribed/processed/error, duration); blocks generated from an audio carry `lms_lesson_blocks.source_media_id`, and uploads are de-duplicated per course by `media.content_hash` (legacy rows by name+size), because course audios must stay out of the meetings `transcripts` pipeline while remaining traceable.
- Micro-devis follow-up sessions are computed by the pure helper `supabase/functions/_shared/micro-devis-followup.ts`, shared by the Micro-devis page and `generate-micro-devis`; the server reads included sessions from the selected catalog formula, descriptions count included plus added sessions, and only additions increase price and catalog duration, because UI and PDF must agree without billing included sessions twice.
- Cold evaluations are native tokenized questionnaires (`sponsor_cold_evaluations`, `participant_cold_evaluations`) planned by `send-thank-you-email` through the pure helper `_shared/cold-evaluation.ts` (one per distinct sponsor, one per participant), reuse one token per recipient and session, get one reminder scheduled after a successful send, and record failures in `scheduled_emails.error_message` while staying pending, because sends must never fail silently or duplicate.
- Cold evaluation eligibility is checked by the shared pure helper both before scheduling and before sending (including reminders and forced calls); excluded rows are cancelled, because catch-up and stale queues must not bypass the deployment cutoff.
- Learner access emails are chosen server-side by a pure helper from `password_set` only (a missing security row means no password; a past sign-in proves nothing unless it was a password sign-in, recorded by `mark_password_proven`): create-password for accounts without a proven password, `learner_course_access` with a direct course link otherwise, because legacy magic-link accounts must never be told to log in with a password they never created.
- Bulk e-learning access emails queue in `learner_access_jobs`, sent server-side by `queue-learner-access-emails` with requester rights, because browser sends blocked the page.
- Password emails use hashed `password_setup_links` redeemed on click, because native recovery tokens expire too soon.
- Learner community reads (posts and children) use security-definer enrollment-scoped helpers, because intra client feeds must stay private.
- CRM opportunity values use the shared pure `_shared/opportunity-value.ts`, so entry points agree.
- Transcript→Réseau links: `link_transcript_to_network_contact` (UI), `_shared/network-tools.ts` (MCP); unlinking keeps the interaction, preserving history.
- Picto-Dico input and challenge guards are DB triggers mirrored in `_shared/pictodico-validation.ts`; the linked event drives challenge number/date, because the webhook is public.
