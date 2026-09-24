---
type: review
target: ../ARCHITECTURE-SPINE.md
lens: rubric (build-substrate, altitude initiative)
reviewed_at: '2026-09-24'
code_ref: 1d5b3a0
---

# Revue rubrique : ARCHITECTURE-SPINE super-tools

## Verdict

**À corriger avant ratification.** La structure est bonne (paradigme clair, 10 AD courts, renvois `[NNN]` tous valides, helpers cités tous existants), mais trois AD marqués `[ADOPTED]` décrivent une cible que le code contredit massivement sans le dire ni la geler par ratchet (AD-6, AD-7, AD-4), AD-2 est plus strict que la règle qu'il cite et que la base, et l'enveloppe opérationnelle (déploiement des edge functions, secrets, observabilité, CORS) est partielle ou contredite.

## Méthode

Lecture intégrale de la spine, puis vérification contre le code au commit `1d5b3a0` : `IMPROVEMENTS.md` (existence des 38 règles citées), `scripts/check-rules.sh` (quels AD ont un check), `supabase/functions/_shared/`, `supabase/config.toml`, `supabase/migrations/` (fonctions SQL d'accès, policies `anon`, buckets), `src/` (hooks, services, garde-fous front), `package-lock.json`, `.github/workflows/`, `RED_TEAM_ASSESSMENT.md`, `docs/observabilite.md`. Les comptages sont faits par grep/script ; leur méthode est donnée pour être rejouée.

## Ce qui tient

- Tous les numéros cités existent dans `IMPROVEMENTS.md` : 001, 004, 006, 008, 009, 014, 015, 017, 019, 020, 021, 023, 024, 026, 027, 030, 031, 034, 036, 037, 038, 042, 044, 045, 046, 047, 049, 050, 052, 054, 058, 059, 061, 062, 063, 065, 068, 069.
- Helpers vérifiés présents : `getSupabaseClient` / `verifyAuth` (`_shared/supabase-client.ts:21,62`), `createJsonResponse` / `createErrorResponse` (`_shared/cors.ts:70,42`), `isInternalCall` / `isInternalOrAuthenticated` (`_shared/cron-auth.ts:23,44`), `aiChat` (`_shared/ai.ts:171`), `todayAsISO` (`src/lib/dateFormatters.ts:113`, `_shared/date-utils.ts:163`), `normalizeEmail` (`src/lib/stringUtils.ts:25`), `useEdgeFunction`, `toastError`, `reportHandledError`, `useDemoMode`, `useConfirm`, `useAutoSaveForm`, `useEntityAutoSave`, `RequireStaff`, `RequireLearner`, `src/lib/demoMask.ts`.
- Fonctions SQL citées présentes : `is_staff_user`, `is_admin`, `has_module_access`, `get_learner_email`, `current_user_access_level`.
- Open Question `has_module_access()` exacte : `20260202130645_…sql:26-41` lit `auth.users` avec `'romain@supertilt.fr'` en dur, jamais redéfinie depuis (seul un `GRANT` dans `20260923071440`).
- Open Question `scheduled-backup` exacte : `verify_jwt = false` (`config.toml:270`), seul test d'appelant trouvé : `includes(SUPABASE_ANON_KEY)` (`scheduled-backup/index.ts:1420`), qui n'est pas une garde.
- AD-8 et la correction du README `migrations-apres-front/` sont cohérents ; la contradiction `docs/AUDIT_AVANT_PUSH.md` est bien signalée.
- Versions de la Stack conformes au lockfile, sauf Vitest (voir L1).

## Findings

### H1 (haut) : AD-6 et AD-7 ratifient une cible que le code contredit, sans check ni ratchet

- **Constat.** Le paradigme affirme « les fonctions n'appellent jamais le tiers en direct » et AD-7 « Les appels LLM passent par `aiChat()` ». Relevé :
  - `api.anthropic.com` appelé en direct par **15** fonctions hors `_shared/` (ex. `crm-ai-assist`, `okr-ai-assistant`, `generate-daily-agenda`, `lms-analyze-transcript`, `analyze-admin-document`), contre **5** fonctions qui utilisent `aiChat(`.
  - `googleapis.com` en direct dans 14 fonctions (ex. `google-calendar-events`, `editorial-engine`, `generate-certificates`, `backup-export`), Fireflies dans 5, WordPress (`wp-json`) dans 3, Brevo 2, GitHub 2, AssemblyAI 11.
  - AD-6 dit « le premier appel à un tiers qui n'en a pas crée ce module » : pour Fireflies, WordPress, Brevo, GitHub, ce premier appel est passé depuis longtemps, et plusieurs copies existent déjà.
  - `check-rules.sh` ne contrôle que Pennylane (`052c`), le refresh OAuth Google (`052a`), les tables MIME (`052b`) et les ids de modèle en dur (`057b`). Rien ne contrôle `aiChat()` ni les hôtes tiers en général.
- **Conséquence.** Un agent qui lit la spine croit l'invariant tenu ; un agent qui lit le code copie le voisin (appel direct). Les deux divergent, ce que la spine devait empêcher. AD-10 est lui-même violé (invariant sans check).
- **Correctif.** (1) Réécrire le paradigme : « le nouveau code n'appelle pas le tiers en direct ; l'existant est gelé par ratchet ». (2) Ajouter dans `check-rules.sh` deux ratchets : nombre de fichiers hors `_shared/` contenant `api.anthropic.com|ai.gateway.lovable.dev` (plafond 15), et nombre de fichiers hors `_shared/` contenant un hôte tiers connu (`googleapis.com|fireflies|wp-json|brevo|api.github.com|assemblyai`). (3) Citer ces ratchets dans AD-6 / AD-7. (4) Préciser dans AD-7 que `src/lib/claude-models.ts` est la seconde copie contrôlée par [057] (la spine dit que les ids « ne vivent que » dans `_shared/claude-models.ts`, et `_shared/api-pricing.ts` en contient aussi comme clés de tarif).

### H2 (haut) : AD-4 repose sur une règle non vérifiée par machine, et l'Open Question sous-estime l'écart

- **Constat.** [063] figure dans `MANUAL_RULES="002|013|022|024|029|032|033|063"` (`scripts/check-rules.sh:324`) : la garde des fonctions `verify_jwt = false` n'est vérifiée que par revue. Or 228 fonctions sur 243 sont `verify_jwt = false`. L'Open Question ne cite que `scheduled-backup`, alors que d'autres n'ont aucune garde visible en tête de handler, par exemple `send-mission-email-draft/index.ts:14-60` (envoie un email à partir d'un `draftId` du body, sans `verifyAuth` ni `isInternal*`), `test-sheet-append`, `zip-mission-deliverables`, `record-db-size`, `process-daily-summary`. `RED_TEAM_ASSESSMENT.md` recense encore E3, E7 et ~25 crons `process-*` / `backfill-*` non gardés (E8).
- **Conséquence.** AD-10 (« un invariant n'existe que s'il est vérifié par une machine ») est contredit par l'AD le plus sensible. Une nouvelle fonction publique sans garde passe la CI.
- **Correctif.** Ajouter un check `063` : toute fonction `verify_jwt = false` de `config.toml` doit, dans son `index.ts`, importer `verifyAuth`, `isInternalCall`, `isInternalOrAuthenticated` ou un vérificateur de signature/token, sauf si elle figure dans une liste déclarée par classe (lien public, webhook, MCP) ; geler l'existant par ratchet. Retirer [063] de `MANUAL_RULES`. Remplacer l'Open Question `scheduled-backup` par « N fonctions `verify_jwt = false` sans garde détectée (liste : sortie du check) ».

### H3 (haut) : AD-2 contredit [009] et la base sur les policies `anon`

- **Constat.** AD-2 : « Jamais de policy `anon` sur une table ». [009] dit autre chose : une policy `anon` est permise si elle valide un token. La base contient encore des policies `anon` actives (non supprimées dans `migrations/`), par exemple `sup_public_select` (`training_supports`), `sec_public_select`, `media_public_select`, `public_read_survey_by_token` (`mission_surveys`), `public_insert_survey_responses` / `public_insert_survey_answers` (`20260601140000_mission_surveys.sql:69-70`, `WITH CHECK (true)`), `anon_read_published_courses` (`lms_courses`). La migration `20260923071440` rend `EXECUTE` à `anon` sur `is_admin`, `is_staff_user`, `has_module_access` précisément parce que des policies s'appliquent au rôle `public`.
- **Conséquence.** Un agent qui ajoute un formulaire public ne sait pas s'il doit écrire une policy `anon` à token ([009]) ou une RPC `get_*_by_token` (AD-2). Deux unités feront deux choix.
- **Correctif.** Choisir et écrire : soit AD-2 s'aligne sur [009] (« une policy `anon` n'existe que si elle valide un token ; le chemin préféré pour du nouveau code est la RPC `SECURITY DEFINER` »), soit [009] est durci et un ratchet compte les policies `TO anon` / `TO public` actives. Lister les policies `anon` existantes en Open Question.

### M1 (moyen) : l'enveloppe opérationnelle est partielle et en partie contredite

- **Secrets.** La convention dit « clés d'API tierces lues via `_shared/api-keys.ts` ». Seules 5 fonctions l'importent ; 35 variables distinctes sont lues par `Deno.env.get` (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FIREFLIES_API_KEY`, `ASSEMBLYAI_API_KEY`, `OPENAI_API_KEY`, `INSEE_API_KEY`, `GH_DISPATCH_TOKEN`, secrets de cron et de webhook…). Il y a deux magasins (secrets Supabase et table `app_settings`) sans règle de choix : c'est un point de divergence direct pour toute nouvelle intégration. La spine ne dit rien non plus de la rotation, ni de qui lit `app_settings` quand il contient des clés.
- **CORS.** AD-4 dit « jamais `*` », mais `_shared/cors.ts:8` retombe sur `"*"` si `APP_ORIGIN` n'est pas défini, et rien ne prouve qu'il l'est en prod (`RED_TEAM_ASSESSMENT.md:92`, `TECH_DEBT_AUDIT.md:74-80` le demandent encore).
- **Déploiement.** Le front est publié par Lovable (dit), les migrations sont jouées « explicitement » (par qui, avec quel outil, et comment on sait lesquelles sont appliquées : non dit). Le déploiement des **edge functions** n'est décrit nulle part (ni spine, ni `docs/architecture.md`, ni workflow CI) ; le Deferred dit seulement « aucun en CI ».
- **Observabilité.** Pas d'AD ; seules deux mentions dans les conventions. Or `docs/observabilite.md` fixe déjà les trois systèmes (Sentry, `check-functions-health` + `edge_function_health`, email de `scheduled-backup`) et les points de passage uniques. La spine ne le cite pas en source.
- **Correctif.** Ajouter un AD-11 « Enveloppe opérationnelle » qui ratifie : un seul environnement ; magasin de secrets par type (secrets Supabase pour tout secret technique, `app_settings` via `api-keys.ts` pour les clés saisies par l'utilisateur dans Paramètres, à trancher) ; `APP_ORIGIN` obligatoire (le fallback `*` devient une Open Question ou un correctif) ; mécanisme de déploiement des edge functions (à relever, sinon Open Question) ; registre des migrations appliquées (`supabase_migrations.schema_migrations`, cité par le README) ; renvoi à `docs/observabilite.md` comme contrat d'observabilité.

### M2 (moyen) : AD-1 ne liste pas toutes les fonctions d'accès, ce qui invite à la réimplémentation

- **Constat.** AD-1 présente cinq fonctions comme « les fonctions existantes ». La base en a d'autres, utilisées comme référence par les checks : `is_known_learner` (référence de `062b`, `20260922100000_is_known_learner.sql`), `has_crm_access` (garde CRM, cf. `RED_TEAM_ASSESSMENT.md` F5), `is_service_role`.
- **Conséquence.** Un agent qui ne trouve pas « apprenant connu » ou « accès CRM » dans la liste réécrit la condition, exactement ce que [062] interdit.
- **Correctif.** Compléter la liste, ou mieux : dire que le catalogue est l'ensemble des fonctions `is_*` / `has_*` `SECURITY DEFINER` de `supabase/migrations/`, et que `062a` / `062b` en sont les gardiens.

### M3 (moyen) : AD-5 annonce des ratchets qui sont en fait une liste blanche par nom de fichier

- **Constat.** `014b` (`check-rules.sh:363-367`) exempte ~150 noms de fichiers (`LEGACY_DIRECT_SUPABASE`). 156 fichiers de `src/pages` + `src/components` importent le client Supabase. Un fichier exempté peut gagner autant de nouveaux `supabase.from()` qu'il veut ; seul `020` (invoke) et `017` sont de vrais ratchets.
- **Conséquence.** « Pour du code nouveau » n'est pas garanti : du nouveau code dans un fichier ancien passe.
- **Correctif.** Soit remplacer `014b` par un ratchet sur le nombre d'occurrences `supabase\.(from|rpc|storage)` dans `src/pages` et `src/components`, soit écrire dans AD-5 la limite exacte du contrôle (conformément à [066]).

### M4 (moyen) : la Stack ignore le runtime des edge functions

- **Constat.** Les edge functions importent `supabase-js` en trois versions via esm.sh : `@2` non épinglé (74 imports), `@2.49.4` (42), `@2.45.0` (8), plus `deno.land/std@0.190.0` (174). Aucun `deno.json` ni import map.
- **Conséquence.** Deux fonctions écrites en même temps n'ont pas le même client ; `@2` flotte au déploiement.
- **Correctif.** Ajouter à la Stack une ligne « Edge : Deno std 0.190.0, supabase-js via esm.sh » et une convention (version épinglée unique, ou Deferred explicite avec ratchet sur les versions distinctes).

### M5 (moyen) : points de divergence manquants pour le niveau inférieur

- **Agent / MCP.** `binds` inclut `agent`, mais aucun AD ne dit comment un module expose ses données à l'agent. [041] (registry SQL, extracteurs d'indexation, `source_types`) est précisément un point où deux unités divergent ; il n'est pas cité.
- **Ajout d'un module.** Rien ne dit qu'un module nouveau ajoute une valeur à l'enum `app_module`, déclare sa route sous `RequireStaff` dans `src/App.tsx` (lue par le scan démo [070]), et gère l'accès par `has_module_access`. Chaque module le refera à sa façon.
- **LMS.** [039] (policy `SELECT TO authenticated` sur toute table de contenu apprenant) est une règle de frontière d'accès non citée par AD-2.
- **Correctif.** Un AD court « Ajouter un module » (enum, route, garde, accès agent [041]) et citer [039] dans AD-2.

### L1 (bas) : chiffres à sourcer ou corriger

- Vitest : le lockfile donne **4.1.8**, pas 4.0.18 (valeur du `package.json`).
- Buckets : notre relevé des migrations (INSERT + UPDATE `public`) donne **22 publics sur 27**, pas 21 sur 25. Donner la méthode ou le relevé en base.
- « 388 clés littérales » : notre grep donne 602 occurrences `queryKey: [` et 185 premiers segments distincts. « 145 contre 28 » : 131 hooks importent le client, 105 appellent `supabase.from/rpc/storage/functions`, 28 importent `@/services`. Préciser ce qui est compté.
- AD-10 : « joué avant chaque commit » ; aucun hook pre-commit n'existe (pas de `.husky`, pas de `core.hooksPath`). C'est une consigne, pas une machine. Écrire « joué en CI ; avant commit par consigne AGENTS.md ».

### L2 (bas) : Deferred

- « Centraliser les query keys » : deux modules partagent déjà des caches (185 préfixes pour 185 fichiers de hooks, invalidations croisées entre formations, CRM et missions). Un cache invalidé sous une clé et lu sous une autre est une divergence entre unités. Donner au moins une convention minimale (premier segment = nom de table) plutôt que de tout différer.
- Les autres items différés (services, rangement par domaine, staging, déploiement CI) ne laissent pas deux unités diverger : acceptables.

## Grille

| Critère | Résultat |
| --- | --- |
| Fixe les vrais points de divergence, n'en manque aucun | Partiel : manquent secrets, runtime edge, ajout de module, agent [041] (M1, M4, M5) |
| Chaque Rule est applicable et empêche sa divergence | Partiel : AD-4, AD-6, AD-7 sans check ; AD-5 contournable (H1, H2, M3) |
| Rien de différé ne laisse diverger | Presque : query keys (L2) |
| Ratifie sans contredire le code | Non sur AD-2, AD-6, AD-7, convention secrets, CORS (H1, H3, M1) |
| Chaque dimension décidée, différée ou ouverte, enveloppe opérationnelle comprise | Partiel : déploiement edge, secrets, observabilité non tranchés (M1) |
