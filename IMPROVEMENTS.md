# Règles d'amélioration continue

Ce fichier est géré automatiquement par la skill `/learn`.
Chaque règle est issue d'un constat fait pendant le développement — un bug, une question, un pattern identifié.
Ce ne sont pas des tickets : ce sont des **invariants** à vérifier en permanence.

---

## Sécurité

### [044] RLS — une policy ne doit jamais lire `auth.users`, toujours passer par une fonction SECURITY DEFINER
- **Constat** : 03/08/2026, module « Emails reçus » : une ligne existait bien dans `inbound_emails`, le webhook renvoyait 200, et la page `/emails` restait vide sans erreur visible. Cause : la policy `USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email = 'romain@supertilt.fr'))`. Le rôle `authenticated` n'a pas `SELECT` sur `auth.users` : PostgREST renvoie `403 / 42501 permission denied for table users`, le client React Query traite la réponse comme une liste vide et l'UI affiche l'état « aucun email ». Recensement sur la base réelle : 19 policies encore en place lisaient `auth.users` (`api_keys`, `api_request_logs`, `chatbot_knowledge_base`, `balance_sheets`, `breakeven_scenarios`, `cashflow_forecast`, `monthly_reports`) — toutes atteignables depuis l'app par un utilisateur `authenticated`, donc toutes productrices du même 403 silencieux. Aggravant : ces policies faisaient aussi un `EXISTS` direct sur `user_module_access`, dont les policies sont admin-only, donc le sous-`SELECT` renvoyait zéro ligne pour un non-admin même quand le droit existait.
- **Règle** : Interdiction absolue de référencer `auth.users` (ou toute table du schéma `auth`) dans le `USING` ou le `WITH CHECK` d'une policy. Le contrôle de droits passe par une fonction `SECURITY DEFINER` existante : `public.is_admin(auth.uid())`, `public.is_staff_user()`, `public.has_module_access(auth.uid(), '<module>')`. Corollaire : ne pas non plus faire de sous-`SELECT` direct sur une table elle-même protégée par RLS (comme `user_module_access`) — la RLS de la table lue s'applique et produit un faux négatif silencieux. Corollaire [027] : jamais d'email hardcodé pour identifier l'admin.
- **Vérification** : check [044] de `check-rules.sh` (`scripts/check-policy-auth-users.sh`) — aucun bloc `CREATE POLICY` des migrations récentes ne doit contenir `auth.users`. Contrôle en base : `SELECT count(*) FROM pg_policies WHERE qual ILIKE '%auth.users%' OR with_check ILIKE '%auth.users%'` doit renvoyer 0.
- **Fichiers de référence** : `supabase/migrations/20260803112259_*.sql` (remplacement des 19 policies), `scripts/check-policy-auth-users.sh`, fonctions `public.is_admin`, `public.is_staff_user`, `public.has_module_access`
- **Origine** : page « Emails reçus » vide en production, 403 42501 invisible côté UI ; règle [034] — une règle sans mécanisme bloquant n'est pas une règle
- **Date** : 2026-08-03


### [039] RLS LMS — toute table de contenu apprenant doit avoir une policy SELECT pour `authenticated`
- **Constat** : Régression du 15/07/2026 — tous les apprenants de la formation "Facilitation graphique en ligne" ont vu la structure de leur cours (modules, titres de leçons) mais **aucun contenu** (textes, vidéos, images, quiz). Cause : la table `lms_lesson_blocks` (qui stocke le contenu réel des leçons) n'avait qu'une policy SELECT pour `anon` (aperçu public) et pour les staff/admins, **jamais pour `authenticated`**. Les apprenants connectés (rôle `authenticated`, pas `anon`) étaient donc bloqués par RLS. Les tables sœurs `lms_courses`, `lms_modules`, `lms_lessons` avaient elles une policy `USING (true)` pour `authenticated` → structure visible, contenu invisible. Correctif : migration `auth_read_lesson_blocks_published` ajoutant une policy SELECT scoped aux cours publiés.
- **Règle** : Toute table LMS destinée à être lue par les apprenants (`lms_courses`, `lms_modules`, `lms_lessons`, `lms_lesson_blocks`, `lms_quizzes`, `lms_quiz_questions`) DOIT avoir au moins une policy `FOR SELECT TO authenticated` dans les migrations. Quand on durcit les policies (ajout de policies `TO anon` restrictives, ajout de guards staff), toujours vérifier que le rôle `authenticated` — cas d'usage majoritaire — conserve un chemin de lecture. Le scoping "cours publié uniquement" (`c.status = 'published'`) est le pattern recommandé.
- **Vérification** : check [039] de `check-rules.sh` — pour chacune des tables listées, doit exister au moins une policy `FOR SELECT TO authenticated` dans `supabase/migrations/`.
- **Fichiers de référence** : `supabase/migrations/20260715102209_*.sql`, table `lms_lesson_blocks`
- **Origine** : régression production — tous les apprenants sans contenu pendant plusieurs heures
- **Date** : 2026-07-15

---

## DX

### [046] Réglages en base — une migration qui modifie `app_settings` doit conditionner son `UPDATE` à la valeur attendue
- **Constat** : 03-04/08/2026, calibrage du filtre « Marchés publics » en deux passes successives. Les mêmes réglages (`tender_cpv_codes`, `tender_keywords`, `tender_exclusions`) sont éditables depuis l'écran `TenderFilterSettings` **et** modifiés par migration. Un `UPDATE ... WHERE setting_key = 'x'` non conditionné écraserait silencieusement un réglage fait à la main entre deux déploiements, et le réécraserait à chaque rejeu de l'historique — sans erreur, sans trace, avec pour seul symptôme un filtrage qui « revient tout seul » à ses valeurs d'avant. Corollaire découvert dans la foulée : un réglage ne se rétroapplique pas aux données déjà écrites. Après le resserrage, sept lignes rescapées gardaient les critères de la passe précédente dans `matched_on`, ce qui a fait conclure à tort à un rapprochement des codes CPV « par famille » alors que le code compare des chaînes exactes.
- **Règle** : Tout `UPDATE public.app_settings SET setting_value` dans une migration versionnée doit porter, en plus de `setting_key`, une condition sur la valeur attendue (`AND setting_value = '<valeur précédente>'`, ou `AND setting_value NOT LIKE '%<marqueur>%'` pour un ajout idempotent). La migration ne s'applique alors que si personne n'a retouché le réglage depuis l'écran d'administration. Un peuplement initial passe par `ON CONFLICT DO NOTHING`, jamais `DO UPDATE`. Deux corollaires : (1) changer un réglage de filtrage n'affecte que les traitements suivants — prévoir explicitement la purge ou le recalcul des lignes déjà écrites, et ne jamais supprimer celles qui portent une décision humaine ; (2) ne jamais déduire le comportement du code d'un champ de données rémanent, le relire.
- **Vérification** : check [046] de `check-rules.sh` — dans les migrations postérieures au 2026-08-03 15:59, tout `UPDATE public.app_settings` qui écrit `setting_value` doit mentionner `setting_value` une seconde fois, dans son `WHERE`. Deux migrations antérieures (URL GSC, dossiers Drive) sont tolérées : déjà appliquées, valeurs posées une fois pour toutes. Garde-fou vérifié en le faisant échouer volontairement sur une migration jetable (règle [043]).
- **Fichiers de référence** : `supabase/migrations/20260803210000_tender_filter_calibration.sql`, `supabase/migrations/20260804140000_tender_filter_second_pass.sql`, `supabase/migrations/20260803160000_tender_opportunities.sql` (peuplement initial en `ON CONFLICT DO NOTHING`), `src/components/crm/TenderFilterSettings.tsx`
- **Origine** : calibrage du filtre marchés publics en deux passes, avec l'écran de réglages ouvert en parallèle ; diagnostic erroné d'un « rapprochement par famille » tiré de `matched_on` périmés
- **Date** : 2026-08-04

### [042] Migrations — l'historique doit rester rejouable de bout en bout sur une base vierge
- **Constat** : Juillet 2026, le job CI « RLS tests » n'était jamais passé, sur aucune branche : il rejoue tout l'historique avec `supabase db start` et échouait dès janvier sur `relation "public.training_evaluations" does not exist` — une table créée directement en base, hors migration. Les tests pgTAP d'isolation apprenant (règles 030/031) n'avaient donc jamais été exécutés sur une seule PR, alors qu'ils gardent la donnée la plus sensible du produit. Le rejeu complet a révélé 29 migrations cassées en 4 familles : doublons de génération Lovable (table, index, policy ou trigger recréés quelques minutes plus tard), bugs SQL jamais détectés faute de rejeu (`FOR INSERT` avec `USING` au lieu de `WITH CHECK`, table cible d'un `UPDATE` référencée dans le `ON` d'une jointure, `CREATE OR REPLACE` changeant un type de retour, policies lisant `profiles.role` et `profiles.id` qui n'existent pas), une migration posant des policies sur une table créée deux heures plus tard, et un module recréant `email_templates` avec un schéma incompatible avec la production. Rien de tout cela ne se voyait : la base hébergée, elle, avait été construite pas à pas.
- **Règle** : L'historique des migrations est un programme qui doit s'exécuter du premier au dernier fichier sur une base vierge. Toute nouvelle migration s'écrit sous forme idempotente et auto-suffisante : `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`, et pour les policies et triggers soit un `DROP ... IF EXISTS` préalable, soit un `DO $do$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $do$`. Ne jamais dépendre d'un objet créé par une migration postérieure ni d'un objet créé hors migration : si une table a été faite à la main en base, écrire son `CREATE TABLE IF NOT EXISTS` dans la migration qui l'utilise en premier. `CREATE OR REPLACE FUNCTION` ne peut ni changer le type de retour ni retirer des valeurs par défaut : faire précéder d'un `DROP FUNCTION IF EXISTS` avec la signature exacte. Deux fichiers ne doivent jamais partager le même horodatage : la CLI indexe `supabase_migrations.schema_migrations` sur cette version et échoue en `duplicate key` au rejeu, même si les deux corps sont appliqués en production. Ne jamais renommer ni réordonner une migration déjà appliquée : la production la connaît par son nom de version et ne la rejouera pas — corriger son contenu est sans risque, la déplacer ne l'est pas. Un cron ne se désigne jamais par son identifiant numérique (`cron.alter_job(18, …)`) : ce `jobid` n'existe qu'en production, et le rejeu échoue en « Job N does not exist or you don't own it » — utiliser le nom du job, ou garder l'appel derrière un `EXISTS (SELECT 1 FROM cron.job WHERE jobid = …)`.
- **Vérification** : `bash scripts/replay-migrations.sh --all --test` doit afficher « migrations en échec : 0 » puis les tests pgTAP au vert. Le script rejoue les migrations sur un PostgreSQL local sans Docker, en une trentaine de secondes. Checks [042], [042b] et [042c] de check-rules.sh en garde-fous statiques (pas de `CREATE TABLE`/`CREATE INDEX`/`ADD COLUMN` sans `IF NOT EXISTS` dans les migrations récentes, pas de `CREATE POLICY` sans garde dans le même fichier, et jamais deux fichiers partageant le même horodatage de version, et aucun `cron.alter_job`/`cron.unschedule` sur un jobid en dur sans garde — check [042d]), et job CI `rls-tests.yml` sur toute PR touchant `supabase/migrations/`.
- **Fichiers de référence** : `scripts/replay-migrations.sh` (les doublures pg_cron `unschedule` ET `alter_job` lèvent sur un job inconnu comme les vraies : sans ça le banc rend un faux vert là où la CI échoue, constaté le 03/08/2026), `scripts/replay-bootstrap.sql`, `.github/workflows/rls-tests.yml`, `supabase/migrations/20260728140000_mission_page_comments.sql` (forme idempotente complète), `supabase/migrations/20260623120000_add_newsletter_comments.sql` (convention `duplicate_object`)
- **Origine** : job CI rouge sur la PR des commentaires de pages livrables ; diagnostic : rouge depuis toujours, sur toutes les branches, pour une cause vieille de six mois
- **Date** : 2026-07-29

### [043] TypeScript — le garde-fou doit cibler les projets, `tsc --noEmit` seul ne vérifie rien
- **Constat** : Juillet 2026, au déploiement des outils SEO : Lovable signale une erreur de compilation (`cause` absent de `ExternalToast`) sur une ligne livrée par une PR dont le job CI « TypeScript » était vert, et dont `npx tsc --noEmit` en local ne renvoyait rien. Cause : `tsconfig.json` est un fichier solution (`"files": []` + `references`), et les références ne sont suivies qu'en mode `--build`. `npx tsc --noEmit` compilait donc **zéro fichier** et passait toujours. Vérifié en ajoutant une propriété inexistante dans un objet littéral : aucune erreur remontée. Le garde-fou de la règle [032], le job CI et trois skills prescrivaient tous cette commande vide depuis la création du repo. Une fois le vrai typecheck lancé (`tsc -p tsconfig.app.json`), la base était propre à une erreur près : celle que Lovable venait de signaler.
- **Règle** : Le typecheck passe par `npm run typecheck` (`tsc -p tsconfig.app.json --noEmit && tsc -p tsconfig.node.json --noEmit`), jamais par `tsc --noEmit` seul. Cela vaut pour le job CI, les skills, les hooks et toute instruction écrite. Corollaire : un garde-fou qui ne peut pas échouer n'est pas un garde-fou — avant de faire confiance à un check, le faire échouer une fois volontairement.
- **Vérification** : check [043] de `check-rules.sh` — `package.json` doit exposer un script `typecheck` ciblant `tsconfig.app.json`, et aucun `tsc --noEmit` nu ne doit subsister dans `.github/workflows/` ni `.claude/skills/`.
- **Fichiers de référence** : `package.json` (script `typecheck`), `.github/workflows/ci.yml`, `tsconfig.json` (fichier solution)
- **Origine** : erreur de type livrée en production malgré une CI verte, signalée par Lovable au déploiement
- **Date** : 2026-07-29

### [045] Coûts IA — tout appel à une API payante doit écrire un événement `api_usage_events`
- **Constat** : 04/08/2026, consommation Anthropic anormalement élevée sans moyen de savoir d'où elle venait. 40+ edge functions appellent une API facturée (Anthropic, gateway Lovable, OpenAI embeddings, AssemblyAI) et aucune ne traçait sa consommation. La seule comptabilité existante était `agent_conversations.total_input_tokens/total_output_tokens`, agrégée par conversation, sans modèle, sans origine, sans distinction utilisateur/cron, et sans les tokens de cache. L'onglet Monitoring → Usage ne montrait que des clics de navigation : impossible de relier un pic de facture à une fonction.
- **Règle** : Tout appel sortant vers une API facturée doit être suivi d'un log via `_shared/api-usage.ts` (`logAnthropicUsage`, `logLovableUsage`, `logAssemblyAiUsage`, `logEmbeddingUsage` ou `logApiUsage`), en renseignant `origin` (nom de la fonction) et `trigger` (`user` / `cron` / `webhook` / `trigger`). Le log est best-effort : il ne doit jamais faire échouer l'appel métier. Les appels passant par `aiChat()` transmettent `origin`/`operation`/`trigger` en options, le helper se charge du log.
- **Vérification** : check [045] de `check-rules.sh` — tout fichier de `supabase/functions/` qui référence `api.anthropic.com`, `ai.gateway.lovable.dev`, `api.openai.com` ou `api.assemblyai.com/v2/transcript` doit aussi importer `_shared/api-usage.ts`.
- **Fichiers de référence** : `supabase/functions/_shared/api-usage.ts`, `supabase/migrations/20260804090000_api_usage_events.sql`, `src/components/monitoring/ApiUsageTab.tsx`
- **Origine** : facture Anthropic en hausse sans observabilité ; règle [034] — une règle sans mécanisme bloquant n'est pas une règle
- **Date** : 2026-08-04

### [037] Observabilité — toute erreur affichée à l'utilisateur doit aussi être reportée à Sentry
- **Constat** : Audit Sentry de juillet 2026 : "plein de choses cassées mais Sentry ne remonte rien". L'app catch presque toutes les erreurs et les termine en toast (`toastError`, 140+ chemins) ou en réponse d'erreur propre côté edge (`createErrorResponse`), donc rien n'était "non géré" et Sentry — qui ne capture que les exceptions non attrapées — restait vide. Les pannes réelles (saturation passerelle IA 402/429, échecs edge) étaient invisibles par construction.
- **Règle** : Un catch qui se termine en toast sans capture est un angle mort d'observabilité. La stratégie complète est dans `docs/observabilite.md` ; points de passage obligatoires : (1) toute capture front passe par `reportHandledError` (dédupliqué ; string = breadcrumb, pas d'événement) ; (2) `toastError` et le wrapper sonner `@/lib/toast` capturent — passer l'erreur d'origine dans `cause` quand le message affiché est générique, ne jamais importer `sonner` directement ; (3) le `QueryClient` garde un `onError` global sur `queryCache` et `mutationCache` ; (4) côté edge, `createErrorResponse(message, status, { cause, fn })` est le seul point de sortie d'erreur et reporte les 5xx/402/429 — `reportEdgeError` direct est réservé aux crons et webhooks sans réponse JSON standard, jamais combiné à `createErrorResponse` (double événement). Pas de nouveau `catch {}` sans binding ni de réponse d'erreur edge construite à la main (ratchets).
- **Vérification** : checks [037], [037c], [037d] + ratchets [037a], [037b] de check-rules.sh.
- **Fichiers de référence** : `docs/observabilite.md`, `src/lib/sentry.ts` (`reportHandledError`), `src/lib/toast.ts`, `src/lib/toastError.ts`, `src/App.tsx`, `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/sentry.ts`
- **Origine** : constat user — bugs en série sans aucun événement Sentry ; diagnostic : instrumentation branchée sur les erreurs non gérées alors que l'app gère tout
- **Date** : 2026-07-08

### [038] Backup — toute nouvelle table ou bucket de migration doit être ajouté aux listes de backup
- **Constat** : Les fonctions `backup-export` et `scheduled-backup` exportent des listes codées en dur (`TABLES_TO_BACKUP` dupliquée dans les deux fichiers, `STORAGE_BUCKETS` dans scheduled-backup). Les migrations créent des tables et des buckets sans que personne ne mette à jour ces listes : audit de juillet 2026, 19 tables absentes des backups (moteur éditorial complet, `ideas`/`idea_votes`, `wp_articles`, `crm_scheduled_emails`, `training_formulas`…) et 12 buckets non sauvegardés (`support-attachments`, `participant-files`, `lms-content`, `training-supports`…). Une restauration aurait perdu ces données silencieusement.
- **Règle** : Toute migration qui crée une table doit, dans le même commit, soit ajouter la table dans `TABLES_TO_BACKUP` des DEUX fonctions (`backup-export` et `scheduled-backup`), soit l'exclure explicitement dans `scripts/backup-exclusions.txt` (réservé aux données éphémères ou regénérables : caches, rate limits, files d'attente). Les deux listes doivent rester identiques. Même règle pour les buckets storage : `STORAGE_BUCKETS` de scheduled-backup ou exclusion documentée dans `scripts/backup-bucket-exclusions.txt`.
- **Vérification** : `bash scripts/check-backup-tables.sh` doit être vide — il rejoue les CREATE/DROP TABLE des migrations dans l'ordre, détecte les buckets via `storage.buckets` (migrations) et `storage.from()` (code), et compare aux listes et exclusions (check [038] de check-rules.sh, exécuté en pre-commit et CI).
- **Fichiers de référence** : `scripts/check-backup-tables.sh`, `scripts/backup-exclusions.txt`, `scripts/backup-bucket-exclusions.txt`, `supabase/functions/backup-export/index.ts`, `supabase/functions/scheduled-backup/index.ts`
- **Origine** : demande user — "ajouter au harnais la prise en compte des évolutions de la bdd dans la procédure de backup"
- **Date** : 2026-07-08

### [034] Enforcement machine — toute règle doit être appliquée par un mécanisme bloquant, jamais par une consigne seule
- **Constat** : Audit du harnais (juillet 2026) : le hook pre-commit se terminait par `|| true`, donc un échec de check-rules.sh n'a jamais bloqué un commit depuis sa création (les hooks PreToolUse ne bloquent que sur exit code 2). Par ailleurs, aucune règle n'était vérifiée sur les commits Lovable, qui ne passent pas par Claude Code — précisément la source de la majorité des régressions documentées ici (013, 027, 011, 012). Une règle qui n'existe que comme texte dans ce fichier ou dans CLAUDE.md n'est pas un invariant : c'est un vœu.
- **Règle** : Toute règle ajoutée à ce fichier doit être appliquée par au moins un mécanisme machine bloquant : check dans `scripts/check-rules.sh` (exécuté par le hook pre-commit ET par le CI), job CI dédié, ou ratchet pour les migrations progressives. Les mécanismes doivent bloquer réellement (exit code 2 pour un hook PreToolUse, exit 1 pour un job CI). Une règle vérifiable uniquement à la main doit le justifier explicitement dans sa section Vérification.
- **Vérification** : Le check [034] de `check-rules.sh` extrait les IDs de règles de ce fichier et échoue si une règle n'apparaît dans aucun check (whitelist explicite pour les règles legacy à vérification manuelle : 002, 013, 022, 024, 029, 032, 033).
- **Fichiers de référence** : `scripts/check-rules.sh`, `.claude/settings.json` (hook exit 2), `.github/workflows/ci.yml`
- **Origine** : audit du harnais — hook qui ne bloquait pas, règles invisibles pour les commits hors Claude Code
- **Date** : 2026-07-07

### [032] Checklist merge d'un nouveau module — tsc + check-rules + test UI golden path obligatoires
- **Constat** : Lors de la livraison du module Book (juin 2026), les checks tsc et check-rules ont été effectués mais le golden path UI (upload, lightbox, partage, analytics) n'a pas été testé dans un navigateur. Le TypeScript peut être valide et les règles respectées sans que le comportement UI soit correct.
- **Règle** : Avant de merger tout nouveau module, exécuter dans cet ordre : (1) `npm run typecheck` → zéro erreur ; (2) `bash scripts/check-rules.sh` → zéro violation ; (3) tester manuellement dans un navigateur le golden path du module (créer, consulter, partager, edge cases). Les checks (1) et (2) sont nécessaires mais ne suffisent pas — ils ne valident pas le comportement UI.
- **Vérification** : PR checklist : [ ] `npm run typecheck` OK [ ] check-rules OK [ ] golden path testé manuellement dans le navigateur.
- **Fichiers de référence** : `scripts/check-rules.sh`
- **Origine** : Livraison module Book sans test navigateur — UI non vérifiée en conditions réelles.
- **Date** : 2026-06-12

---

## Uploads de fichiers / RLS

### [047] Buckets storage — toujours privés, lecture par URL signée, et la policy SELECT recopie la RLS de la table
- **Constat** : 04/08/2026, module « Marchés publics ». Le bucket `tender-documents` avait été déclaré `public = true` dans la migration, sur le modèle de `mission-documents` et `training-documents` : un DCE est déjà publié par l'acheteur, il n'y avait rien à protéger. La politique de l'espace de travail interdit les buckets publics — le bucket a dû être créé privé à la main au déploiement. Trois conséquences, toutes invisibles jusqu'au test de bout en bout : (1) l'URL publique stockée en base renvoyait un 401 au téléchargement ; (2) la policy `SELECT` sur `storage.objects` était restée ouverte à tout compte `authenticated`, ce qui était sans effet sur un bucket public mais qui, sur un bucket privé, est exactement ce qui autorise `createSignedUrl` — donc le téléchargement : un apprenant du LMS pouvait se signer une pièce de DCE, alors que la policy RESTRICTIVE `staff_only_select` l'exclut de la table qui la référence ; (3) `ON CONFLICT (id) DO NOTHING` masquait l'écart, la production étant privée et le dépôt disant public — seul un environnement reconstruit aurait rejoué un bucket public, au pire moment.
- **Règle** : Tout nouveau bucket se crée avec `public = false`, sans exception : la politique de l'espace de travail refuse les buckets publics, et la migration doit dire ce qui existera vraiment. La lecture passe par une URL signée à la volée (`resolveEntityDocumentUrl` pour les documents d'entité, `createSignedUrl` sinon), jamais par une URL publique stockée en base — la signature fonctionne aussi sur un bucket public, donc aucune branche par type d'entité n'est nécessaire. La policy `SELECT` sur `storage.objects` doit reprendre le **même** contrôle d'accès que la table métier qui référence les fichiers : si la table porte `staff_only_select`, la policy storage porte `public.is_staff_user()`. Sur un bucket privé, cette policy n'est pas décorative, c'est la porte du téléchargement. Corollaire : `ON CONFLICT DO NOTHING` ne corrige jamais un bucket existant — quand un bucket a été créé hors migration, aligner le dépôt à la main sur la réalité, sinon l'écart ne se voit qu'à la reconstruction. L'écriture reste soumise à la règle [026] : upload par edge function en service_role, jamais depuis le frontend.
- **Vérification** : check [047] de `check-rules.sh` — aucune migration postérieure au 2026-08-04 ne doit créer un bucket avec `true` en position `public` dans `INSERT INTO storage.buckets`. Contrôle en base : `SELECT id FROM storage.buckets WHERE public` ne doit renvoyer que les buckets historiques. Garde-fou mis en échec volontairement avant d'être retenu (règle [043]).
- **Fichiers de référence** : `supabase/migrations/20260804160000_tender_ai_and_documents.sql` (bucket privé, policy storage réservée au staff, motif écrit dans le fichier), `src/hooks/useEntityDocuments.ts` (`resolveEntityDocumentUrl`), `supabase/functions/upload-tender-document/index.ts`
- **Origine** : déploiement de la synthèse IA des marchés publics — bucket refusé en public par la politique de l'espace de travail, et trou de droits révélé par la bascule en privé
- **Date** : 2026-08-04

### [026] Uploads — toujours passer par une edge function avec service_role_key, jamais de storage+insert direct depuis le frontend

- **Constat** : Entre février et mai 2026, plusieurs tables (`crm_attachments`, `trainer_documents`, `support_ticket_attachments`, `training_participants`) ont accumulé des policies RLS contradictoires ou insuffisantes (email en dur, doublon de policies de même nom avec syntaxes différentes, jeux de policies ajoutés sans DROP des précédents). Chaque fois que Lovable créait une table ou modifiait un bucket, il ajoutait de nouvelles policies sans supprimer les anciennes. Le frontend qui faisait `supabase.storage.upload()` + `supabase.from(table).insert()` directement dépendait de cette configuration fragile — elle cassait silencieusement dès qu'un utilisateur non-admin uploadait.
- **Règle** : **Toute opération combinant un upload storage et un insert/update en base de données DOIT passer par une edge function Supabase utilisant `createClient(url, SUPABASE_SERVICE_ROLE_KEY)`.** La service role key bypass intégralement les RLS — son comportement ne dépend d'aucune policy. Le frontend n'appelle que `supabase.functions.invoke("upload-xxx", { body: formData })` et ne touche jamais directement au storage ni à la DB pour les écritures liées aux uploads.
- **Pattern obligatoire** :
  ```ts
  // ✅ Correct — edge function avec service role
  const { data, error } = await supabase.functions.invoke("upload-mon-document", { body: formData });
  
  // ❌ Interdit — storage direct + insert direct (dépend des RLS policies)
  await supabase.storage.from("mon-bucket").upload(path, file);
  await supabase.from("ma_table").insert({ ... });
  ```
- **Vérification** : `grep -rn "supabase\.storage\.from" src/ --include="*.ts" --include="*.tsx"` ne doit retourner que des appels en **lecture** (getPublicUrl, createSignedUrl, download, remove) — jamais `.upload()`. Tout `.upload()` dans `src/` est une violation.
- **Fichiers de référence** : `supabase/functions/upload-trainer-document/index.ts`, `supabase/functions/upload-training-document-field/index.ts`, `supabase/functions/upload-participant-invoice/index.ts`, `supabase/functions/upload-crm-image/index.ts`, `supabase/functions/upload-crm-attachment/index.ts`, `supabase/functions/upload-support-attachment/index.ts`
- **Origine** : Régression majeure — 4 mois d'accumulation de policies RLS contradictoires générées par Lovable, causant des erreurs "new row violates row-level security policy" sur tous les uploads utilisateurs non-admin.
- **Date** : 2026-05-12

---

## Catch-up mid-session

### [025] Ajout participant en cours de session — rattraper welcome + émargements déjà envoyés
- **Constat** : Quand un participant est ajouté à une formation qui a déjà démarré mais n'est pas terminée (ex: classe virtuelle J2/J5), deux bugs se produisent : (1) le mail d'accueil est skippé car `getEmailMode(start_date)` renvoie `status: "non_envoye"` dès que `daysUntilStart <= 0` — le participant ne reçoit donc ni lien Zoom, ni logistique, ni convocation ; (2) s'il existe déjà des demandes d'émargement envoyées aux autres participants (ligne `attendance_signatures.email_sent_at IS NOT NULL`), le nouveau participant n'a ni token ni mail — il ne peut pas émarger. `useAddParticipant` n'avait aucun hook pour couvrir ces cas.
- **Règle** : Pour toute action « participant ajouté à une formation » (AddParticipantDialog, BulkAddParticipantsDialog, mais aussi tout autre point d'entrée futur), détecter le cas « formation en cours » avec `isTrainingOngoing(start_date, end_date)` puis : (a) forcer l'envoi du welcome email même si `status === "non_envoye"` (sauf e-learning qui a son flow) ; (b) invoquer `catchUpAttendanceSignaturesForParticipant(trainingId, participantId)` qui renvoie les demandes d'émargement au nouveau participant pour chaque (schedule_date, period) déjà notifié aux autres — via le paramètre `participantIds` de l'edge function `send-attendance-signature-request`. Skipper le needs_survey en mode ongoing. Mode fire-and-forget : l'ajout réussit même si le rattrapage échoue, toast warning si erreur.
- **Vérification** : `grep -rn "isTrainingOngoing\|catchUpAttendanceSignaturesForParticipant" src/` — tout flow d'ajout de participant futur doit s'appuyer sur ces helpers. Vérifier que `useAddParticipant` et `BulkAddParticipantsDialog` n'ont pas régressé. Pour tout nouveau dialog d'ajout : même pattern.
- **Fichiers de référence** : `src/lib/emailScheduling.ts` (`isTrainingOngoing`), `src/services/participants.ts` (`catchUpAttendanceSignaturesForParticipant`), `src/hooks/useAddParticipant.ts` (étape 2 + 2b), `src/components/formations/BulkAddParticipantsDialog.tsx`, `supabase/functions/send-attendance-signature-request/index.ts` (paramètre `participantIds`).
- **Origine** : bug user — participant ajouté à une classe virtuelle J2 n'a pas reçu le lien de connexion ni la demande d'émargement déjà envoyée aux autres.
- **Date** : 2026-04-23

## Duplication

### [003] Extraire getFileType() dans file-utils.ts — ne jamais dupliquer une fonction utilitaire
- **Constat** : La fonction `getFileType(file: File)` était dupliquée à l'identique dans `EntityMediaManager.tsx` et `MediaUploadDialog.tsx`. Le même bug (`file.type` au lieu de `resolveContentType()`) a dû être corrigé dans les deux fichiers.
- **Règle** : Toute fonction utilitaire doit exister en un seul exemplaire dans `src/lib/`. Si elle est copiée-collée, l'extraire immédiatement.
- **Vérification** : Chercher les fonctions définies dans plusieurs composants avec le même nom ou le même corps.
- **Fichiers de référence** : `src/lib/file-utils.ts`
- **Origine** : bug SVG non uploadable — même correction appliquée deux fois
- **Date** : 2026-03-20

## Architecture

### [048] Prompt caching de l'agent — un `cache_control` sur le seul `system` ne cache rien tant que la fenêtre de compaction glisse
- **Constat** : 04/08/2026, audit de la consommation Anthropic. `agent-chat` posait un `cache_control` sur son bloc `system` (schéma + tools) et s'en tenait là : le tableau `messages`, renvoyé en entier à chaque round d'une boucle d'outils pouvant aller à 25 tours, était refacturé plein tarif. Le coût d'entrée d'un tour croissait donc en N². Aggravant et invisible : `compactForApi` tronquait les `tool_result` au-delà des 6 derniers messages avec une **fenêtre glissante**, donc un message envoyé entier au round N devenait tronqué au round N+3. Les octets du préfixe changeaient en cours de tour : même en ajoutant un point de cache sur l'historique, il n'aurait jamais pu être relu. Le commentaire du code affirmait « le prompt sert de préfixe de cache », ce qui était vrai pour le `system` et faux pour tout le reste — d'où une fausse impression de couverture. Après correctif, mesure en production sur une même conversation : round 1 `cache_write` 36 460 tokens (0,136 $), round 2 `cache_read` 36 460 tokens (0,011 $), soit 12,5x moins cher — exactement le rapport 1,25 / 0,10 des tarifs d'écriture et de lecture de cache.
- **Règle** : Le prompt caching est un **match de préfixe** : tout octet qui change avant un point de cache invalide tout ce qui suit. Deux conséquences à tenir ensemble, l'une sans l'autre ne sert à rien. (1) Poser des points de cache sur l'**historique**, pas seulement sur le `system` — au moins sur le dernier bloc du dernier message, plus un point en retrait car un breakpoint ne remonte que 20 blocs de contenu pour retrouver une entrée de cache. (2) Garantir que le préfixe rendu est **append-only pendant un tour** : toute compaction, troncature ou réécriture de l'historique doit utiliser une frontière **figée au début du tour**, jamais une fenêtre relative à la longueur courante. Plafond de 4 points de cache par requête, `system` compris. Ne jamais poser de `cache_control` sur un bloc `thinking` (il porte une signature). Ne jamais laisser fuiter `cache_control` dans l'historique persisté en base.
- **Vérification** : check [046] de `check-rules.sh` — `agent-chat` doit appeler `withCacheBreakpoints(compactForApi(..., compactionCutoff))` et le test d'invariant `_shared/agent-history.test.ts` doit exister. Ce test rejoue plusieurs rounds et exige que le préfixe déjà rendu soit identique octet pour octet d'un round au suivant ; un contre-test documente la régression sans cutoff figé. Contrôle en production : dans Monitoring → Coûts API, les `cache_read` d'une conversation multi-rounds doivent être non nuls dès le round 2. S'ils restent à zéro, un invalidateur silencieux est revenu.
- **Fichiers de référence** : `supabase/functions/_shared/agent-history.ts` (`compactForApi` avec `frozenCutoff`, `withCacheBreakpoints`), `supabase/functions/_shared/agent-history.test.ts`, `supabase/functions/agent-chat/index.ts`
- **Origine** : constat user — « SuperTools brûle des crédits Anthropic comme jamais » ; l'analyse du code a montré que le cache annoncé ne couvrait que le `system`
- **Date** : 2026-08-04

### [041] Agent SuperTools — les 3 référentiels de l'agent doivent rester synchronisés (registry SQL, extracteurs d'indexation, source_types de recherche)
- **Constat** : Audit de l'agent (juillet 2026), en deux temps. (1) Le system prompt de `agent-chat` décrivait en dur les modules Transcripts, Témoignages et Dropshipping alors que `agent_schema_registry` (allowlist SQL) ne contenait aucune de ces tables : l'agent tentait des requêtes systématiquement rejetées. En parallèle, `index-documents` indexait 23 source types mais la description du tool `search_content` n'en listait que 21. (2) Correctif incomplet : seules les *tables* manquantes avaient été ajoutées, jamais les *colonnes*. Mesure : **232 tables en base, 44 dans le registre, et 422 colonnes manquantes** sur les 44 enregistrées (`missions` 12 déclarées sur 34, `trainings` 15 sur 64, `crm_cards` 13 sur 45). Conséquence concrète : l'agent a affirmé à l'utilisateur que les missions n'avaient pas de champ d'action datée, alors que `waiting_next_action_date` existe — il ne la voyait simplement pas. Une liste écrite à la main ne peut pas suivre une base de 232 tables.
- **Règle** : Tout module ou table exposé à l'agent doit être enregistré de façon cohérente dans les 3 couches : (1) `agent_schema_registry` (migration) pour le SQL ; (2) un extracteur dans `index-documents` + trigger d'indexation pour le RAG ; (3) la liste `source_types` du tool `search_content` dans `agent-chat`, qui doit refléter exactement les extracteurs. Ne jamais décrire des tables en dur dans le system prompt. **Et ne jamais recopier des colonnes à la main** : `get_agent_schema_prompt()` les génère depuis `pg_catalog`, le registre ne portant que l'allowlist (`is_queryable`), les descriptions, les colonnes masquées et, facultativement, des descriptions de colonnes. Ajouter une table à l'agent = une ligne dans le registre, jamais une liste de colonnes.
- **Vérification** : checks [041] et [041b] de `check-rules.sh` — chaque extracteur de `index-documents/index.ts` doit apparaître dans la description `source_types` de `agent-chat/index.ts`, et la dernière migration définissant `get_agent_schema_prompt` doit lire `pg_attribute` (génération depuis le catalogue, pas de retour à une liste figée).
- **Fichiers de référence** : `supabase/functions/agent-chat/index.ts`, `supabase/functions/index-documents/index.ts`, `supabase/migrations/20260402130000_agent_audit_log_and_schema_registry.sql`
- **Origine** : constat user — "notre agent est con comme la lune" ; audit : il était aveugle sur les modules dont on lui parlait
- **Date** : 2026-07-27

### [028] Blocs LMS — tout bloc avec editor + viewer doit être activé dans BuilderInsertMenu
- **Constat** : `GalleryBlockEditor`, `GalleryBlockViewer`, `HtmlEmbedBlockEditor`, `HtmlEmbedBlockViewer` existaient tous les quatre, les types TypeScript et les entrées dans `registry.tsx` étaient corrects, mais les deux blocs n'étaient pas dans `ACTIVE_CONTENT_TYPES` de `BuilderInsertMenu.tsx` → affichés grisés avec badge "soon" et inutilisables malgré une implémentation complète.
- **Règle** : Quand un type de bloc LMS a un editor (`.../editors/XxxBlockEditor.tsx`) ET un viewer (`.../viewers/XxxBlockViewer.tsx`), il doit obligatoirement apparaître dans `ACTIVE_CONTENT_TYPES` de `BuilderInsertMenu.tsx` ET avoir une entrée dans `BLOCK_META` (description + raccourci clavier). Un bloc sans ces deux ajouts reste grisé même si tout le reste est implémenté.
- **Vérification** : comparer les types listés dans `ACTIVE_CONTENT_TYPES` (`src/components/lms/builder/BuilderInsertMenu.tsx`) avec les fichiers présents dans `src/components/lms/blocks/editors/` — tout type `XxxBlockEditor.tsx` dont le type correspondant n'est pas dans `ACTIVE_CONTENT_TYPES` est une violation. Commande : `for f in src/components/lms/blocks/editors/*BlockEditor.tsx; do type=$(basename "$f" BlockEditor.tsx | sed 's/\([A-Z]\)/_\1/g' | tr '[:upper:]' '[:lower:]' | sed 's/^_//'); grep -q "\"$type\"" src/components/lms/builder/BuilderInsertMenu.tsx || echo "MISSING in ACTIVE_CONTENT_TYPES: $type"; done`
- **Fichiers de référence** : `src/components/lms/builder/BuilderInsertMenu.tsx` (ACTIVE_CONTENT_TYPES + BLOCK_META), `src/components/lms/blocks/registry.tsx`
- **Origine** : galerie d'images et HTML embed grisés "soon" dans le menu d'insertion malgré editors et viewers complets
- **Date** : 2026-05-21

### [014] Séparation Pages → Hooks → Client Supabase — jamais d'accès données dans les composants UI
- **Constat** : L'architecture agent-chat (AgentChat.tsx, useAgentChat.ts, useAgentConversations.ts) respecte une séparation propre en 3 couches : (1) les **pages** orchestrent les composants et appellent les hooks, (2) les **hooks** encapsulent toute la logique métier (state, SSE streaming, CRUD), (3) seul le **client Supabase** accède aux données. Un point de vigilance : `AgentIndexationSettings.tsx` fait un `fetch()` direct au lieu de passer par un hook — à surveiller pour ne pas propager ce raccourci. Les fichiers restent sous ~400 lignes ; au-delà, extraire un sous-composant ou splitter le hook.
- **Règle** : Aucun composant UI (pages ou composants) ne doit contenir de `fetch()`, `supabase.from()`, ou accès réseau direct. Toute logique d'accès données doit être dans un hook dédié (`use*.ts`). Seuil de vigilance : extraire un sous-composant dès qu'un fichier dépasse ~400 lignes, splitter un hook dès qu'il dépasse ~300 lignes.
- **Vérification** : `grep -rn "supabase\.from\|\.fetch(" src/components/ src/pages/ --include='*.tsx' | grep -v "use[A-Z].*\.ts"` — tout résultat hors d'un hook est suspect. Vérifier `wc -l` des fichiers modifiés : pages < 400 lignes, hooks < 300 lignes.
- **Fichiers de référence** : `src/pages/AgentChat.tsx` (page, ~408 lignes — limite haute), `src/hooks/useAgentChat.ts` (hook métier, ~288 lignes), `src/hooks/useAgentConversations.ts` (hook CRUD, ~45 lignes)
- **Origine** : audit architectural du module agent-chat après implémentation complète
- **Date** : 2026-04-01

### [013] Lovable over-engineering — simplifier systématiquement les couches d'abstraction générées
- **Constat** : Lovable empile des abstractions pour contourner les problèmes au lieu de traiter la cause racine. Exemples concrets sur ce projet : (1) 6 commits de "runtime recovery" (runtimeRecovery.ts, cache buster, session flags, SW unregister) au lieu de corriger `globPatterns` dans la config PWA ; (2) `lazyWithRetry` wrappant `React.lazy` avec retry applicatif alors que le SW NetworkFirst gère déjà les retries réseau ; (3) `GlobalChunkErrorHandler` + `RouteErrorBoundary` faisant le même job séparément ; (4) `main.tsx` avec dynamic import + try/catch + recovery au lieu d'un import statique. Au total ~350 lignes de code de contournement pour un problème de 1 ligne dans vite.config.ts.
- **Règle** : Après chaque intervention de Lovable, auditer les changements pour détecter : (a) les wrappers qui ne font que passer des props à un enfant unique → inliner ; (b) les mécanismes de recovery/retry qui traitent un symptôme → trouver et corriger la cause racine ; (c) les fichiers utilitaires avec ≤2 imports → candidats à l'inlining ; (d) les composants dupliqués qui font le même job → fusionner. Préférer `React.lazy` natif à un wrapper custom quand le SW gère les erreurs réseau.
- **Vérification** : Après chaque merge de branche Lovable, vérifier : `git diff --stat main...HEAD | grep '+' | sort -t'+' -k2 -rn | head -10` — tout nouveau fichier utilitaire de <30 lignes avec ≤2 imports est suspect. Vérifier que `src/lib/runtimeRecovery.ts` n'a pas été recréé.
- **Fichiers de référence** : `vite.config.ts` (config corrigée), `src/main.tsx` (bootstrap simplifié), `src/App.tsx` (React.lazy natif)
- **Origine** : production cassée — Lovable en boucle sur 6 commits de recovery, audit de simplification supprimant ~2400 lignes
- **Date** : 2026-03-23

### [010] Éditeur Tiptap missions — supprimer une image doit aussi nettoyer le storage
- **Constat** : Les images insérées dans l'éditeur Tiptap des pages mission (upload, drag-drop, coller) sont enregistrées dans le media library via `registerMediaEntry()`, mais il n'existe aucun mécanisme de suppression. Pas de bubble menu, pas de menu contextuel. Si l'utilisateur supprime une image au clavier (Backspace/Suppr), le nœud est retiré du HTML mais le fichier reste orphelin dans le bucket `mission-media` et l'entrée persiste en base. Seul l'onglet Galerie (`EntityMediaManager`) offre une suppression complète (storage + BDD).
- **Règle** : Toute insertion d'image dans un éditeur riche doit avoir un mécanisme de suppression symétrique qui nettoie le fichier storage ET l'entrée en base. L'éditeur Tiptap des missions doit proposer un bubble menu sur les images avec au minimum un bouton supprimer. La suppression doit appeler `deleteMediaFile()` + `useDeleteMedia()` comme le fait `EntityMediaManager`.
- **Vérification** : Vérifier que `MissionPages.tsx` inclut un `BubbleMenu` ou un `NodeViewWrapper` pour les images avec une action de suppression. Chercher les appels `registerMediaEntry` sans `deleteMediaFile` correspondant dans le même fichier.
- **Fichiers de référence** : `src/components/missions/MissionPages.tsx` (upload sans delete), `src/components/media/EntityMediaManager.tsx` (bon pattern avec delete complet), `src/hooks/useMedia.ts` (`deleteMediaFile`, `useDeleteMedia`)
- **Origine** : question "est-ce qu'on peut supprimer une image dans une mission ?"
- **Date** : 2026-03-23

### [006] React Query — désactiver refetchOnWindowFocus pour ne jamais perdre l'état des formulaires
- **Constat** : Sur quasiment tous les formulaires avec des dropdowns, changer d'onglet/application et revenir faisait disparaître les choix sélectionnés. React Query a `refetchOnWindowFocus: true` par défaut : chaque retour d'onglet déclenchait un refetch de toutes les queries, les options des selects se rechargaient, et la valeur sélectionnée était perdue (Radix UI valide la sélection contre la liste d'options). Bug récurrent depuis 1 mois malgré des corrections ponctuelles qui ne ciblaient jamais la config globale.
- **Règle** : `refetchOnWindowFocus: false` doit être défini globalement dans le QueryClient. Ne jamais ajouter `refetchOnWindowFocus: true` sur des queries qui alimentent des formulaires. Les `useEffect` qui initialisent un formulaire depuis des données query doivent être gardés par un ID (ex: `entity.id !== prevIdRef.current`) pour ne pas écraser les modifications en cours lors d'un refetch.
- **Vérification** : `grep -r "refetchOnWindowFocus: true" src/` — tout résultat est suspect. Vérifier que le QueryClient dans `App.tsx` a bien `refetchOnWindowFocus: false`. Chercher `useEffect` + `setValues`/`setValue`/`setFormData` dépendant de données query sans garde par ID.
- **Fichiers de référence** : `src/App.tsx` (config QueryClient), `src/components/crm/CardDetailDrawer.tsx` (bon pattern avec `prevCardIdRef`), `src/pages/EventEdit.tsx` (corrigé avec `prevEventIdRef`)
- **Origine** : bug récurrent — les sélections dropdown disparaissent au changement d'onglet sur tous les formulaires
- **Date** : 2026-03-20

## Pattern

### [040] Filtres de liste — filtrer côté client sur les données affichées, jamais refetch par un id issu d'une liste d'entités complète
- **Constat** : Sur la page Évaluations, la dropdown "Filtrer par formation" listait toutes les lignes de la table `trainings` (nom seul, sans discriminant) et chaque sélection relançait une requête serveur `.eq("training_id", id)`. Les formations dupliquées (sessions) partagent le même `training_name` : les entrées étaient indiscernables et sélectionner une ligne dont l'id ne portait aucune évaluation affichait systématiquement 0, alors que la vue "Toutes les formations" montrait bien les évaluations. L'erreur éventuelle de requête était en plus avalée (`const { data } = await query` sans lecture de `error`).
- **Règle** : Quand une page affiche déjà le dataset complet, un filtre (dropdown, tabs…) doit : (1) dériver ses options des données chargées (ids réellement présents dans les lignes affichées), pas d'une table d'entités entière ; (2) filtrer côté client sur ces mêmes données — la sélection filtre alors exactement ce que l'utilisateur voit, aucun désaccord possible entre options et résultats ; (3) afficher un discriminant (date de session, client) quand les noms d'entités sont duplicables. Refetch serveur uniquement si le dataset complet n'est pas chargeable. Et toujours lire `error` des requêtes supabase (règle 037 : `toastError` avec `cause`).
- **Vérification** : check [040] de `check-rules.sh` — `src/pages/Evaluations.tsx` ne doit plus contenir de refetch `.eq("training_id"` et doit dériver `trainingOptions` des évaluations chargées.
- **Fichiers de référence** : `src/pages/Evaluations.tsx` (`trainingOptions`, `filteredEvaluations`)
- **Origine** : bug user — "quand je choisis une formation dans la dropdown, ça affiche toujours 0" alors que toutes les évaluations et la note moyenne s'affichent en vue globale
- **Date** : 2026-07-23

### [036] Crons pg_cron — jamais vault.decrypted_secrets, secret dédié inline posé directement en base
- **Constat** : Les crons `editorial-backfill` et `editorial-engine-weekly` (et vraisemblablement tous les crons du repo utilisant le même pattern : `cleanup-pending-email-drafts`, `generate-daily-actions`, `process-live-upcoming-notifications`…) échouaient silencieusement depuis leur création : `vault.decrypted_secrets` est vide sur ce projet (`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` n'y existent pas), donc `url := NULL` → violation NOT NULL dans `net.http_request_queue`, zéro exécution réussie et zéro alerte. Sur Lovable Cloud, la service_role n'est pas récupérable côté utilisateur, donc impossible de peupler le vault.
- **Règle** : Tout nouveau cron pg_cron appelant une edge function doit : (1) authentifier l'appel par un header `x-cron-secret` comparé à une variable d'environnement de la fonction (ex: `EDITORIAL_CRON_SECRET`), jamais par la service_role via vault ; (2) être planifié avec l'URL du projet et le secret **inline, directement en base** (via Lovable ou SQL Editor), jamais dans une migration versionnée — un secret dans une migration finit dans le repo ; (3) la migration versionnée peut créer la table/fonction mais PAS le `cron.schedule` avec secret. Après création d'un cron, vérifier `cron.job_run_details` sur la première exécution.
- **Vérification** : Aucune migration postérieure au 2026-07-08 ne doit contenir `vault.decrypted_secrets` ni `x-cron-secret` (check [036] de check-rules.sh). Les migrations antérieures sont legacy : leurs crons ont été re-planifiés directement en base.
- **Fichiers de référence** : `supabase/functions/editorial-backfill/index.ts` (triple voie d'auth : x-cron-secret / x-internal-secret / JWT), `supabase/functions/editorial-engine/index.ts`
- **Origine** : mise en service du moteur éditorial — cron en échec silencieux depuis sa création, diagnostiqué via `net.http_request_queue`
- **Date** : 2026-07-08

### [035] Liens supports/LMS dans les emails — toujours personnalisés par destinataire avec ?email=
- **Constat** : Le player LMS public identifie l'apprenant par le paramètre `?email=` de l'URL (pas de login). Le mail de remerciement post-formation envoyait le lien vers l'e-learning sans ce paramètre dans plusieurs chemins (URL explicite sur la formation, envoi planifié `force-send-scheduled-email` qui n'avait aucune résolution LMS, lien collé en dur dans un template personnalisé) : les participants obtenaient "Accès non autorisé. Veuillez utiliser le lien fourni par votre formateur."
- **Règle** : Toute edge function qui envoie un email contenant un lien vers `/formation-support/` ou `/lms/` DOIT utiliser `_shared/supports-url.ts` : `resolveSupportsUrlBase()` pour construire la variable `{{supports_url}}`, `appendEmailParam()` pour la personnaliser, et `personalizeSupportsLinks()` en balayage final sur le HTML avant `sendEmail()` (couvre les liens collés en dur dans les templates custom). Les URLs externes (Drive, Notion…) ne sont pas modifiées.
- **Vérification** : `grep -rln 'supports_url' supabase/functions/ --include='index.ts' | xargs grep -L 'supports-url.ts'` doit être vide — toute fonction qui manipule supports_url sans importer le helper est une violation (check [035] de check-rules.sh).
- **Fichiers de référence** : `supabase/functions/_shared/supports-url.ts` (+ tests), `supabase/functions/send-thank-you-email/index.ts`, `supabase/functions/force-send-scheduled-email/index.ts`, `supabase/functions/process-live-reminders/index.ts`, `supabase/functions/process-today-reminders/index.ts`, `src/pages/LmsCoursePlayer.tsx` (la garde `!learnerEmail`)
- **Origine** : bug user — participants d'une formation intra recevant "Accès non autorisé" en cliquant le lien e-learning du mail de remerciement
- **Date** : 2026-07-07

### [029] LmsCourseHomePage — invariants de layout à ne jamais régresser
- **Constat** : La page d'accueil du cours LMS a été redesignée 3+ fois pour corriger les mêmes problèmes : (1) hero avec vidéo à gauche au lieu de droite, (2) absence de la rangée de 3 cards stats (progression / prochain live / communauté), (3) absence de barres de progression par module dans la sidebar, (4) absence de la liste des modules avec CTAs (Commencer/Continuer/Revoir) sur la home.
- **Règle** : `LmsCourseHomePage` doit toujours respecter cette structure sur la vue `home` : (1) `HeroSection` avec **texte gauche, vidéo droite** (premier enfant du grid = texte, second = vidéo) ; (2) rangée `sm:grid-cols-3` : `ProgressCard` + `LiveCard` + `CommunityInfoCard` ; (3) `ModulesListSection` (barres de progression + bouton CTA par module) + `TipsBlock` en grille `lg:grid-cols-[1fr_300px]` ; (4) les deux instances de `Sidebar` reçoivent la prop `lessonsDoneByModule` pour afficher les barres de progression par module.
- **Vérification** : Dans `src/pages/LmsCourseHomePage.tsx`, vérifier : (a) le premier enfant de `<section className="grid lg:grid-cols-2">` dans `HeroSection` est le bloc texte (et non la vidéo) ; (b) la vue `home` contient `<ProgressCard`, `<LiveCard`, `<CommunityInfoCard` ; (c) `<ModulesListSection` et `<TipsBlock` sont présents dans la vue `home` ; (d) les appels `<Sidebar` ont la prop `lessonsDoneByModule={lessonsDoneByModule}`.
- **Fichiers de référence** : `src/pages/LmsCourseHomePage.tsx`
- **Origine** : page redesignée 3+ fois pour les mêmes régressions de layout
- **Date** : 2026-05-22

### [024] Drawer auto-save — préférer `useEntityAutoSave` pour les drawers d'édition d'entité
- **Constat** : 5 drawers (`MissionDetailDrawer`, `CardDetailDrawer`, `ContentCardDialog`, `EventEdit`, `EventDetail`) répètent le même triptyque : (1) `useEffect([entityId])` qui hydrate les `useState` depuis l'entité + appelle `resetTracking()`, (2) un `handleAutoSave` `useCallback` quasi-identique qui fait `try { await mutation.mutateAsync({id, updates: values}); return true; } catch { return false }`, (3) un `useEffect([open])` qui appelle `flushAndGetPending()` et déclenche `mutation.mutate(...)` à la fermeture. Soit ~30 lignes de boilerplate par drawer.
- **Règle** : Pour un drawer/dialog qui édite une entité avec `useAutoSaveForm`, préférer `useEntityAutoSave({ entity, open, formValues, setFromEntity, onSave })` depuis `@/hooks/useEntityAutoSave`. Le caller fournit uniquement les `useState` + le memo `formValues` + un callback `setFromEntity(entity)` qui hydrate les états + un callback `onSave(id, values)` qui appelle la mutation. Le hook orchestre l'hydratation, l'auto-save, et le flush-on-close. **Exception** : si le drawer a un mode "création sans entité" (ex: `ContentCardDialog`) ou un flush déclenché manuellement par navigation (ex: `EventEdit.handleBack`), conserver `useAutoSaveForm` direct.
- **Vérification** : `grep -rn 'useAutoSaveForm' src/components/ src/pages/ --include='*.tsx'` — chaque consumer non-trivial devrait justifier pourquoi il n'utilise pas `useEntityAutoSave`.
- **Fichiers de référence** : `src/hooks/useEntityAutoSave.ts`, `src/components/missions/MissionDetailDrawer.tsx` (premier consumer migré).
- **Origine** : audit d'architecture — pattern dupliqué dans 5 drawers
- **Date** : 2026-04-15

### [023] Date du jour ISO — utiliser `todayAsISO()` au lieu de `new Date().toISOString().slice(0, 10)`
- **Constat** : Le pattern `new Date().toISOString().slice(0, 10)` (récupère la date du jour au format `YYYY-MM-DD`) était dupliqué dans plusieurs fichiers. Pareil pour `dateAsISO(date)` qui sérialise une `Date` arbitraire au même format.
- **Règle** : Utiliser `todayAsISO()` ou `dateAsISO(date)` depuis `@/lib/dateFormatters`. Plus largement, utiliser les helpers de `dateFormatters.ts` au lieu de réinventer formats `format(parseISO(...), ...)` ou `toLocaleDateString("fr-FR", ...)` dans chaque composant.
- **Vérification** : `grep -rn 'new Date().toISOString().slice(0, 10)' src/` hors `dateFormatters.ts` doit être vide.
- **Fichiers de référence** : `src/lib/dateFormatters.ts`.
- **Origine** : audit d'architecture — formatage de date inconsistant
- **Date** : 2026-04-15

### [022] Tags input — utiliser `<TagsInput>` au lieu de réimplémenter add/remove inline
- **Constat** : Le pattern `useState<string[]>([])` + `useState("")` + `handleAddTag` (trim + dedupe) + `handleRemoveTag` (filter) + UI Input/Button/Enter était dupliqué dans plusieurs drawers (`MissionDetailDrawer`, `ContentCardDialog`). Chaque occurrence = ~40 lignes.
- **Règle** : Utiliser `<TagsInput value={tags} onChange={setTags} />` depuis `@/components/ui/tags-input`. Props : `placeholder`, `lowercase`, `variant="badge"|"pill"`. Le composant encapsule son propre state d'input.
- **Vérification** : `grep -rn 'setTags(\\[\\.\\.\\.tags,' src/ --include='*.tsx' --include='*.ts'` — les résultats doivent être limités aux cas avec feature spéciale (ex: `<datalist>` autocomplete dans `WatchAddDialog`).
- **Fichiers de référence** : `src/components/ui/tags-input.tsx`, `src/components/missions/MissionSettingsTab.tsx`, `src/components/content/ContentCardDialog.tsx`.
- **Origine** : audit d'architecture — ~3 occurrences dupliquées
- **Date** : 2026-04-15

### [021] Confirmation — utiliser `useConfirm()` au lieu de `window.confirm()`
- **Constat** : `if (confirm("Supprimer…"))` était utilisé dans 4 composants pour les suppressions. Le prompt système du navigateur casse le design et n'est pas stylable.
- **Règle** : Utiliser le hook `useConfirm()` depuis `@/hooks/useConfirm`. Il retourne `{ confirm, ConfirmDialog }` : appeler `await confirm({ title, description, confirmText, variant })` et rendre `<ConfirmDialog />` dans le composant. Ne JAMAIS appeler `confirm()` (API DOM) directement.
- **Vérification** : `grep -rn 'if (confirm(' src/ --include='*.tsx' --include='*.ts'` doit être vide.
- **Fichiers de référence** : `src/hooks/useConfirm.tsx`, `src/components/missions/MissionDetailDrawer.tsx`, `src/components/crm/CardDetailDrawer.tsx`, `src/components/crm/CrmColumnHeader.tsx`, `src/components/chatbot/KnowledgeBaseManager.tsx`.
- **Origine** : audit d'architecture — 4 occurrences
- **Date** : 2026-04-15

### [020] Edge functions — toujours utiliser `useEdgeFunction()` pour invoquer une fonction Supabase
- **Constat** : `supabase.functions.invoke()` est appelé 107 fois dans 73 fichiers. Chaque caller réimplémente le même pattern : `useState(loading)` + `useState(result)` + try/catch + `toast` d'erreur + `setLoading(false)` en `finally`. Environ 30-40 lignes de boilerplate par invocation, avec des variations sur le format de réponse (`data.result` vs `data` vs réponse complète).
- **Règle** : Utiliser le hook `useEdgeFunction<T>(functionName, { errorMessage?, successToast?, silentOnError? })` depuis `@/hooks/useEdgeFunction`. Il retourne `{ loading, result, error, invoke, reset }`. Appeler `await invoke(body)` qui retourne `T | null` (null en cas d'erreur). Ne PAS appeler `supabase.functions.invoke` directement dans un composant/hook non dédié.
- **Exception** : les hooks dédiés à une fonction (ex: `useBackup.ts` qui invoque `backup-export` + `backup-import` en flow chaîné) peuvent rester inline si la logique dépasse ce que le hook générique gère. À garder <5% des cas.
- **Vérification** : `grep -rn 'supabase\.functions\.invoke' src/` hors `src/hooks/useEdgeFunction.ts` doit être ≤ quelques cas justifiés. Migration progressive : check staged pour le pré-commit + ratchet [020] dans `scripts/rules-ratchet.txt` — le compte ne peut que baisser.
- **Fichiers de référence** : `src/hooks/useEdgeFunction.ts`, `src/components/missions/MissionDetailDrawer.tsx` (usage type pour AI summary).
- **Origine** : audit d'architecture — 107 occurrences dupliquées
- **Date** : 2026-04-15

### [019] Toasts d'erreur — toujours utiliser `toastError()` pour le variant destructive
- **Constat** : `toast({ title: "Erreur", description: "...", variant: "destructive" })` est répété 143 fois dans 64 fichiers, avec des variations de titre (parfois "Erreur !", parfois pas de titre) qui cassent la cohérence UX. Chaque handler réécrit le même template.
- **Règle** : Utiliser `toastError(toast, description)` (ou `toastError(toast, error)` si on passe une Error) depuis `@/lib/toastError`. Centralise le titre "Erreur", le variant destructive, et la conversion `Error → message`. Ne PAS écrire `toast({ title: "Erreur"..., variant: "destructive" })` directement.
- **Vérification** : `grep -rn 'toast(\{[^}]*title:\s*"Erreur"' src/` hors `src/lib/toastError.ts` doit être vide après migration.
- **Fichiers de référence** : `src/lib/toastError.ts`, `src/components/missions/MissionDetailDrawer.tsx` (migration exemple), `src/components/crm/CardDetailDrawer.tsx`.
- **Origine** : audit d'architecture — 143 occurrences dupliquées
- **Date** : 2026-04-15

### [018] Copie presse-papier — toujours utiliser `useCopyToClipboard()`
- **Constat** : `navigator.clipboard.writeText()` est appelé 28 fois dans 22 fichiers. Chaque usage réimplémente son propre `setCopied` + `setTimeout` + toast "Lien copié" (ou l'oublie, créant des incohérences UX : parfois un toast apparaît, parfois non). 3 fichiers utilisent `sonner` au lieu de shadcn toast pour ce feedback — double fragmentation.
- **Règle** : Utiliser le hook `useCopyToClipboard()` depuis `@/hooks/useCopyToClipboard`. Il retourne `{ copied, copy }`. Appeler `await copy(text)` ou `await copy(text, { title, description, silent })`. Ne JAMAIS appeler `navigator.clipboard.writeText` directement dans un composant.
- **Vérification** : `grep -rn 'navigator\.clipboard\.writeText' src/` hors `src/hooks/useCopyToClipboard.ts` doit être vide.
- **Fichiers de référence** : `src/hooks/useCopyToClipboard.ts`, `src/components/missions/MissionDetailDrawer.tsx` (usage exemple), `src/components/crm/CardDetailDrawer.tsx`.
- **Origine** : audit d'architecture — 28 occurrences dupliquées + incohérences UX
- **Date** : 2026-04-15

### [017] Spinner de chargement — toujours utiliser `<Spinner />`
- **Constat** : Le pattern `<Loader2 className="h-4 w-4 animate-spin" />` est répété 351 fois dans 196 fichiers avec des variations (h-6 w-6, text-muted-foreground, mr-2, etc.) qui rendent toute modification stylistique impossible à propager.
- **Règle** : Utiliser `<Spinner />` depuis `@/components/ui/spinner`. Props : `size` (sm=h-4/w-4 défaut, md=h-6/w-6, lg=h-8/w-8) et `className` pour les classes additionnelles (couleur, margins). Ne PAS écrire `<Loader2 className="..animate-spin" />` inline.
- **Vérification** : `grep -rEn 'Loader2[^>]*animate-spin' src/` hors `src/components/ui/spinner.tsx` doit être vide (migration progressive : check staged pour le pré-commit + ratchet [017] dans `scripts/rules-ratchet.txt` — le compte ne peut que baisser).
- **Fichiers de référence** : `src/components/ui/spinner.tsx`, `src/components/missions/MissionDetailDrawer.tsx`, `src/components/crm/CardDetailDrawer.tsx`, `src/components/shared/NextActionScheduler.tsx`, `src/components/missions/MissionSettingsTab.tsx` (tous migrés).
- **Origine** : audit d'architecture — 351 occurrences, pattern purement répété
- **Date** : 2026-04-15

### [016] React Query mutations — ne jamais mettre l'objet mutation dans les deps d'un useEffect
- **Constat** : `CardDetailDrawer.tsx` avait un `useEffect(() => { ... updateCard.mutateAsync(...) ... }, [autoSaveUpdates, updateCard])`. `updateCard` (retourné par `useUpdateCard()`) est un objet React Query dont la référence change à chaque transition d'état (idle → loading → success → idle). Après chaque save, l'effet se redéclenchait → nouvelle save → boucle infinie de sauvegardes toutes les 1-2s, même sans modification utilisateur. L'auto-save des opportunités CRM générait ainsi des saves continues "partout" jusqu'à ce que le bug soit isolé.
- **Règle** : Ne jamais inclure un objet mutation React Query (résultat d'un hook `useXxxMutation`, `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx`) dans le tableau de dépendances d'un `useEffect` qui appelle `.mutateAsync()` ou `.mutate()`. Stocker la mutation dans un `ref` mis à jour à chaque render (`const updateCardRef = useRef(updateCard); updateCardRef.current = updateCard;`) et l'appeler via le ref dans l'effet. Compléter avec une détection de dirty (hash `JSON.stringify` comparé à un `lastSavedHashRef`) pour skip les saves identiques — c'est ce que fait déjà `useAutoSaveForm`.
- **Vérification** : `grep -rEn '\], \[[^]]*\b(update|create|delete)[A-Z][a-zA-Z]*\b[^]]*\]' src/ --include='*.tsx' --include='*.ts'` — toute ligne ressemblant à `}, […, updateXxx, …])` après un useEffect qui appelle `.mutateAsync` est suspecte. Vérifier manuellement que la variable n'est pas un simple callback mais bien un objet mutation.
- **Fichiers de référence** : `src/components/crm/CardDetailDrawer.tsx` (corrigé : `updateCardRef` + `lastSavedFieldsHashRef`), `src/hooks/useAutoSaveForm.ts` (pattern canonique avec hash comparison)
- **Origine** : bug "l'enregistrement automatique des cartes est toutes les 2-3 secondes" — boucle infinie causée par `updateCard` dans les deps
- **Date** : 2026-04-15

### [002] Gestion de fichiers — architecture mutualisée via EntityDocumentsManager / EntityMediaManager
- **Constat** : L'upload/gestion de fichiers est correctement mutualisé. Les seuls cas spécialisés (participants, CRM, support) le sont pour des raisons métier valides.
- **Règle** : Toute nouvelle entité nécessitant des fichiers doit utiliser `EntityDocumentsManager` (documents) ou `EntityMediaManager` (médias), avec les hooks `useEntityDocuments` / `useMedia`.
- **Vérification** : Vérifier qu'aucun nouveau composant ne réimplémente l'upload from scratch.
- **Fichiers de référence** : `src/components/shared/EntityDocumentsManager.tsx`, `src/components/media/EntityMediaManager.tsx`, `src/hooks/useEntityDocuments.ts`, `src/hooks/useMedia.ts`, `src/lib/file-utils.ts`
- **Origine** : question "est-ce que l'ajout de fichier est un code mutualisé ?"
- **Date** : 2026-03-20

### [001] Auto-save — toujours utiliser useAutoSaveForm
- **Constat** : `MissionDetailDrawer` réimplémentait le pattern auto-save manuellement (skipNextSaveRef, saveTimeoutRef, pendingUpdatesRef) alors que le hook `useAutoSaveForm` existait déjà. Corrigé.
- **Règle** : Tout formulaire avec auto-save doit utiliser le hook `useAutoSaveForm`. Ne jamais réimplémenter le pattern manuellement.
- **Vérification** : Chercher `setTimeout` + `save` ou `saveTimeoutRef` dans les composants formulaire — si trouvé, c'est une violation.
- **Fichiers de référence** : `src/hooks/useAutoSaveForm.ts`
- **Origine** : question "est-ce que l'auto-save peut être refactorisé ?"
- **Date** : 2026-03-20

### [015] Modules authentifiés — toujours utiliser ModuleLayout + PageHeader
- **Constat** : Plusieurs pages ajoutées par Lovable ou par Claude n'utilisaient pas le layout standard (`ModuleLayout` + `PageHeader`). Résultat : pas de sidebar, pas de footer, pas de header cohérent. Le problème est systémique : aucune procédure de contrôle automatique n'existait pour le détecter. Les pages publiques (auth, formulaires token-based, landing, learner portal) sont légitimement exemptées.
- **Règle** : Toute nouvelle page authentifiée dans `src/pages/` DOIT utiliser `ModuleLayout` comme wrapper ET `PageHeader` avec icône et titre. Exceptions documentées : pages publiques (Auth, Signup, ResetPassword, ForcePasswordChange, Landing, PolitiqueConfidentialite, Emargement, Evaluation, Questionnaire, TrainerEvaluation, SponsorEvaluation, ReclamationPublic, SignatureConvention, SignatureDevis), pages learner (LearnerPortal, LearnerAccess, LmsCoursePlayer), wizard (Onboarding), pages d'erreur (NotFound, FormulaireRedirect), utilitaires (Screenshots, Index), et interfaces full-screen spécialisées avec header custom (AgentChat, ArenaDiscussion, ArenaSetup, ArenaResults, Dashboard, FormationDetail, MissionSummary, TrainingSummary, TrainingSupportPage).
- **Vérification** : Lister les pages TSX dans `src/pages/` qui n'importent ni `ModuleLayout` ni `PageHeader`. Croiser avec la liste d'exceptions connues. Toute page non exemptée sans ces imports est une violation.
- **Fichiers de référence** : `src/components/ModuleLayout.tsx`, `src/components/PageHeader.tsx`
- **Origine** : constat que la règle header/footer générique n'était ni documentée ni contrôlée — violations passées inaperçues
- **Date** : 2026-04-03

## Convention

### [005] Overlays hover sur images — toujours promouvoir en couche GPU
- **Constat** : Les vignettes de la galerie (`MediaGrid`, `EntityMediaManager`) ramaient au hover. Les overlays `transition-opacity` sur des images pleine résolution déclenchaient un repaint complet à chaque frame. Le `backdrop-blur-sm` sur les badges aggravait le problème.
- **Règle** : Tout overlay avec `transition-opacity` sur une image doit avoir `will-change-[opacity]`. Les images sous l'overlay doivent avoir `will-change-transform`. Ne jamais utiliser `backdrop-blur` sur des éléments qui se superposent à des images dans une grille.
- **Vérification** : Chercher `transition-opacity` dans les composants media/galerie — vérifier que `will-change` est présent. Chercher `backdrop-blur` sur des badges superposés à des images.
- **Fichiers de référence** : `src/components/media/MediaGrid.tsx`, `src/components/media/EntityMediaManager.tsx`
- **Origine** : lag au hover sur les vignettes de la galerie
- **Date** : 2026-03-20

### [004] Toujours utiliser resolveContentType() — jamais file.type directement
- **Constat** : `file.type` peut être vide sur certains navigateurs (notamment Safari pour les SVG). La fonction `resolveContentType()` gère ce cas avec un fallback par extension.
- **Règle** : Ne jamais utiliser `file.type` directement. Toujours passer par `resolveContentType(file)`.
- **Vérification** : `grep -r "file\.type" src/` — tout résultat hors de `file-utils.ts` est suspect.
- **Fichiers de référence** : `src/lib/file-utils.ts` (resolveContentType)
- **Origine** : bug SVG — `file.type` vide sur certains navigateurs
- **Date** : 2026-03-20

## Responsive

### [033] Navigation mobile — boutons retour et sidebars toujours accessibles sur touch
- **Constat** : Trois bugs mobiles récurrents découverts en juin 2026 : (1) `BuilderTopbar` avait son bouton Retour en `hidden lg:flex` → aucun moyen de quitter un e-learning sur mobile ; (2) la sidebar dossiers de `LmsCourses` était en `hidden lg:flex` → les dossiers invisibles sur mobile ; (3) le renommage d'un cours e-learning déclenchable uniquement par `onDoubleClick` → inopérant sur touch.
- **Règle** : (a) Jamais de `hidden lg:*` sur un élément de navigation critique (bouton retour, breadcrumb, menu principal) — masquer le texte sur mobile est acceptable (`hidden lg:inline`), masquer l'élément entier ne l'est pas. (b) Toute sidebar desktop-only (`hidden lg:flex`) doit avoir un équivalent mobile : drawer, chips scrollables, ou select. (c) Toute interaction déclenchée uniquement par `onDoubleClick` ou `hover` doit avoir un fallback accessible par tap (bouton explicite ou entrée de menu contextuel).
- **Vérification** : `grep -rn "hidden lg:" src/` — chaque résultat sur un élément de navigation (bouton retour, lien, back, sidebar) est une violation potentielle. Vérifier que tout `onDoubleClick` a un équivalent dans un menu contextuel ou un bouton visible.
- **Fichiers de référence** : `src/components/lms/builder/BuilderTopbar.tsx` (bouton retour mobile), `src/pages/LmsCourses.tsx` (chips dossiers mobile `lg:hidden`)
- **Origine** : rapport utilisateur — impossible de revenir en arrière dans un e-learning sur mobile, dossiers LMS invisibles sur mobile
- **Date** : 2026-06-18

### [007] Modales et dialogues — toujours `w-full sm:max-w-{size}` pour le mobile
- **Constat** : 11 modales (CRM, formations, onboarding) avaient des largeurs fixes (`max-w-2xl`, `max-w-lg`, etc.) sans `w-full` mobile. Sur un écran < 480px, la partie gauche était tronquée et le contenu inaccessible. Même problème sur les `SheetContent` (ex: Support `w-[480px]` sans `w-full`).
- **Règle** : Tout `DialogContent`, `AlertDialogContent` ou `SheetContent` doit utiliser `w-full sm:max-w-{size}`. Toute grille de formulaire (`grid-cols-2`, `grid-cols-3`) doit avoir un fallback mobile `grid-cols-1 sm:grid-cols-N`.
- **Vérification** : Chercher `DialogContent.*max-w-` et `SheetContent.*w-\[` sans `w-full` précédent. Chercher `grid-cols-[2-9]` sans `grid-cols-1 sm:` dans les composants formulaire.
- **Fichiers de référence** : tous les `DialogContent` dans `src/components/`
- **Origine** : modale ticket support tronquée sur mobile — audit de 11 modales
- **Date** : 2026-03-21

## Sécurité

### [031] Isolation données apprenants — toutes les tables staff protégées en SELECT + edge functions critiques bloquées

- **Constat** : La migration `20260521140000_learner_write_guard.sql` bloquait les écritures (INSERT/UPDATE/DELETE) des apprenants sur les tables staff, mais contenait le commentaire erroné *"read-only leak is low-risk"*. En réalité, un apprenant authentifié pouvait lire : toutes les opportunités CRM, tous les devis, toutes les missions, toute la veille concurrentielle. De plus, la edge function `agent-chat` (qui a accès à toutes les données via service role) n'avait aucun blocage apprenant — un apprenant pouvait invoquer l'agent pour extraire n'importe quelle table. La fonction `notify-lms-comment` n'avait aucune authentification, permettant le spam et l'usurpation d'identité.
- **Règle** :
  1. **SELECT RESTRICTIVE sur les tables staff** : toute table contenant des données métier (CRM, missions, quotes, watch, improvements, newsletters, email_templates, training_supports, coaching_summaries, agent_schema_registry…) doit avoir une policy `AS RESTRICTIVE FOR SELECT TO authenticated USING (public.is_staff_user())`. La liste canonique est dans `20260529100000_staff_select_guard.sql`.
  2. **agent-chat** : bloquer les apprenants immédiatement après `verifyAuth` (décodage JWT local, pas de round-trip réseau). L'agent utilise la service role key — sans ce check, un apprenant peut requêter n'importe quelle table via l'outil `query_database`.
  3. **Policies `FOR ALL TO authenticated USING (true)`** : interdit sur les tables sensibles. Les tables LMS accessibles aux apprenants doivent avoir des policies scoped (`learner_email = auth.jwt() ->> 'email'`), pas un accès global.
  4. **Policies `FOR ALL TO anon`** : interdit sauf pour les formulaires publics token-based (émargement, évaluation). Toute autre policy `anon` est une violation.
  5. **Edge functions sans auth** : toute fonction callable depuis le frontend doit appeler `verifyAuth`. Si la fonction est légitime pour les apprenants (ex: notify-lms-comment), vérifier que le payload correspond au JWT appelant (anti-usurpation).
- **Vérification** :
  - `grep -rn "FOR ALL TO authenticated USING (true)" supabase/migrations/` — les seuls résultats acceptables sont les tables LMS publiques avec politique de scoping apprenant.
  - `grep -rn "FOR ALL TO anon" supabase/migrations/` — seuls les formulaires token-based sont acceptés.
  - `grep -n "learner" supabase/functions/agent-chat/index.ts` — doit retourner le bloc 403.
  - `grep -n "verifyAuth" supabase/functions/notify-lms-comment/index.ts` — doit être présent.
  - Tests comportementaux : `supabase/tests/rls_learner_isolation.test.sql` (pgTAP, workflow `rls-tests.yml`) vérifie qu'un apprenant authentifié lit zéro ligne — plus fiable que les greps sur les migrations.
- **Fichiers de référence** : `supabase/migrations/20260529100000_staff_select_guard.sql`, `supabase/migrations/20260529110000_fix_open_authenticated_policies.sql`, `supabase/functions/agent-chat/index.ts`, `supabase/functions/notify-lms-comment/index.ts`, `supabase/tests/rls_learner_isolation.test.sql`
- **Origine** : audit de sécurité — apprenant pouvait lire CRM/missions/devis via RLS `USING (true)` + extraire toutes les données via agent-chat (service role key sans guard rôle)
- **Date** : 2026-05-29

---

### [030] Isolation chatbot apprenant — double blocage UI + edge function, zéro donnée Super Tools

- **Constat** : Le `ChatbotProvider` affichait le widget à tout utilisateur authentifié, apprenants inclus. Les edge functions `rag-chatbot` et `chatbot-query` injectaient dans le contexte des données métier internes (`trainings`, `formation_configs`, `improvements`) via la service role key, sans aucune vérification du rôle appelant. Un apprenant authentifié pouvait interroger le chatbot et obtenir des informations sur la plateforme Super Tools, le catalogue complet, et les formations d'autres clients.
- **Règle** : Le chatbot Super Tools (plateforme) et le chatbot apprenant (formation) sont deux produits distincts avec des bases de connaissance et des audiences isolées. Invariants :
  1. **UI** : `ChatbotProvider` ne doit jamais rendre le widget si `session.user.user_metadata?.role === "learner"`.
  2. **Edge functions** (`rag-chatbot`, `chatbot-query`) : authentification obligatoire (401 si absent) + blocage explicite si `user_metadata.role === "learner"` (403). La couche serveur ne doit pas dépendre de la couche UI.
  3. **Contexte RAG** : seule la table `chatbot_knowledge_base` est injectée dans le contexte. Les tables `trainings`, `formation_configs`, `improvements` sont interdites — elles contiennent des données métier clients.
  4. **Chatbot apprenant futur** : s'il est créé, il doit utiliser une edge function dédiée, n'accédant qu'aux données d'inscription de l'apprenant appelant (vérifiées via son JWT), et ne jamais connaître les fonctionnalités Super Tools.
- **Vérification** :
  - `grep -n "isAuthenticated\|setIsAuthenticated" src/components/chatbot/ChatbotProvider.tsx` — ne doit pas exister. La garde doit utiliser `user_metadata?.role !== "learner"`.
  - `grep -n "learner" supabase/functions/rag-chatbot/index.ts supabase/functions/chatbot-query/index.ts` — doit retourner les blocs 403.
  - `grep -n "trainings\|formation_configs\|improvements" supabase/functions/rag-chatbot/index.ts` — ne doit retourner aucun appel `.from(`.
- **Fichiers de référence** : `src/components/chatbot/ChatbotProvider.tsx`, `supabase/functions/rag-chatbot/index.ts`, `supabase/functions/chatbot-query/index.ts`
- **Origine** : faille de sécurité — apprenant pouvait interroger le chatbot plateforme et accéder aux données métier internes via service role key
- **Date** : 2026-05-29

---

### [027] Check admin — toujours lire `profiles.is_admin`, jamais un email hardcodé
- **Constat** : Lovable a remplacé le check `profiles.is_admin` par un RPC `is_admin()` vérifiant uniquement l'email `romain@supertilt.fr`. En production, tous les utilisateurs avec `is_admin = true` en base sont devenus non-admins du jour au lendemain. N'ayant pas de records dans `user_module_access`, ils ont vu une sidebar entièrement vide — bug critique bloquant l'app pour tous les utilisateurs.
- **Règle** : La détection du statut admin dans `useModuleAccess` doit toujours passer par `supabase.from("profiles").select("is_admin").eq("user_id", user.id).single()`. Ne jamais remplacer ce check par une vérification d'email hardcodé (que ce soit dans le frontend ou dans un RPC). Le champ `profiles.is_admin` est la source de vérité et supporte plusieurs admins.
- **Vérification** : `grep -n "is_admin" src/hooks/useModuleAccess.ts` doit montrer un accès à la table `profiles`, pas un appel `supabase.rpc("is_admin", ...)` ni une comparaison avec un email en dur.
- **Fichiers de référence** : `src/hooks/useModuleAccess.ts`
- **Origine** : régression majeure — sidebar vide pour tous les utilisateurs en production après tentative de "fix" Lovable
- **Date** : 2026-05-20

### [008] CORS — ne jamais utiliser `Access-Control-Allow-Origin: *` en production
- **Constat** : Toutes les edge functions Supabase (50+) utilisent un header CORS wildcard `"Access-Control-Allow-Origin": "*"` via `_shared/cors.ts`. Cela expose les API à des appels depuis n'importe quel site externe (risque CSRF, abus de quotas API).
- **Règle** : Les headers CORS doivent restreindre l'origine aux domaines légitimes. Utiliser la configuration centralisée dans `_shared/cors.ts` avec le domaine de production.
- **Vérification** : `grep -r '"Access-Control-Allow-Origin": "\*"' supabase/functions/` — aucun résultat ne devrait apparaître.
- **Fichiers de référence** : `supabase/functions/_shared/cors.ts`
- **Origine** : audit de sécurité approfondi
- **Date** : 2026-03-21

### [009] RLS — les policies publiques (anon) doivent toujours valider un token
- **Constat** : Plusieurs policies RLS pour les formulaires publics (questionnaire, émargement, évaluation) utilisent `USING (true)` au lieu de valider le token d'accès. Tout utilisateur anonyme peut lire/modifier les données de tous les participants.
- **Règle** : Toute policy RLS pour le rôle `anon` doit inclure une validation de token dans la clause `USING`. Ne jamais utiliser `USING (true)` pour des données sensibles accessibles publiquement.
- **Vérification** : `grep -rn "TO anon" supabase/migrations/ | grep -i "USING (true)"` — tout résultat est une violation.
- **Fichiers de référence** : `supabase/migrations/20260130*.sql`, `supabase/migrations/20260202180500*.sql`
- **Origine** : audit de sécurité approfondi
- **Date** : 2026-03-21

## DX

### [012] Lovable scaffolding — auditer et supprimer le code mort après chaque génération
- **Constat** : Lovable génère systématiquement du code scaffolding jamais utilisé : 13 composants UI Radix (hover-card, sidebar, menubar…), des wrappers à 1 import (ReviewSection.tsx), du CSS legacy (App.css), et des imports inutilisés (useTranslation dans Landing.tsx). Au total 1947 lignes mortes accumulées en quelques semaines de génération.
- **Règle** : Après chaque session Lovable, vérifier les fichiers générés/modifiés. Supprimer tout composant UI avec 0 imports, tout wrapper qui ne fait que passer des props à un enfant unique, tout fichier CSS non importé, et tout import non utilisé. Ne jamais laisser du code mort "au cas où".
- **Vérification** : `for f in src/components/ui/*.tsx; do name=$(basename "$f" .tsx); count=$(grep -r "from.*ui/$name" src/ --include='*.tsx' --include='*.ts' -l | grep -v "ui/$name.tsx" | wc -l); [ "$count" -eq 0 ] && echo "DEAD: $name"; done` — aucun résultat ne devrait apparaître.
- **Fichiers de référence** : `src/components/ui/` (composants gardés = composants importés)
- **Origine** : audit de simplification — 15 fichiers morts supprimés (1947 lignes)
- **Date** : 2026-03-23

### [011] PWA — ne jamais précacher les JS chunks, utiliser NetworkFirst pour les scripts
- **Constat** : `globPatterns: ["**/*.{js,css,html,ico,svg}"]` dans la config Vite PWA précachait tous les JS chunks (279 fichiers, 5.3 Mo). Après chaque deploy, le Service Worker servait des chunks avec des hashes périmés → erreur "Failed to fetch dynamically imported module" → écran blanc. Lovable a empilé 6 commits de "runtime recovery" (clear SW, cache buster, session flags) sans jamais traiter la cause racine.
- **Règle** : Les JS chunks ne doivent JAMAIS être dans `globPatterns` du Service Worker. Utiliser `globPatterns: ["**/*.{css,html,ico,svg}"]` et une stratégie `NetworkFirst` pour les scripts dans `runtimeCaching`. Ne jamais ajouter de logique de "runtime recovery" pour contourner un problème de cache SW — corriger la config à la source.
- **Vérification** : `grep 'globPatterns' vite.config.ts` ne doit PAS contenir `js`. `grep -A2 'destination.*script' vite.config.ts` doit montrer `NetworkFirst`.
- **Fichiers de référence** : `vite.config.ts` (config workbox corrigée)
- **Origine** : production cassée — écran blanc après chaque deploy, Lovable en boucle sur 6 commits de recovery
- **Date** : 2026-03-23
