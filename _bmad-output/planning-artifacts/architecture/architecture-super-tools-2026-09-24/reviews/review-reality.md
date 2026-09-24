# Revue « confrontation au réel » : ARCHITECTURE-SPINE.md

Date : 2026-09-24. Base : HEAD `6769863` (aucun changement de code depuis `fea1468`, source déclarée de la spine : les 5 commits intermédiaires ne touchent que `_bmad/` et `_bmad-output/`).
Méthode : chaque nom, numéro, version et chiffre de la spine confronté au dépôt (package.json, package-lock, node_modules, `.github/workflows/`, `IMPROVEMENTS.md`, `scripts/`, `supabase/`). Preuve statique uniquement, aucune lecture de la base hébergée.

## Verdict

Solide sur les noms (fonctions, fichiers, tables, règles citées : tous existent), mais plusieurs règles ADOPTED décrivent comme un fait établi ce qui n'est qu'une cible, et trois chiffres ou affirmations sont faux. À corriger avant ratification.

## Findings

### F1. Majeur : AD-6, AD-7 et le paradigme affirment un état que le code contredit

- Spine, Design Paradigm : « les fonctions n'appellent jamais le tiers en direct ». AD-7 : « Les appels LLM passent par `aiChat()` ».
- Réel : `aiChat(` n'est appelé que par 5 `index.ts`. 15 fonctions appellent `api.anthropic.com` en direct (`agent-chat`, `crm-ai-assist`, `generate-daily-agenda`, `lms-analyze-audio`, `extract-balance-sheet`, `okr-ai-assistant`, `network-ai-assistant`, etc.). Appels directs hors `_shared/` aussi pour `googleapis.com` (14 fonctions), `api.openai.com` (5), `wp-json` (3), `api.fireflies.ai` (3), `api.assemblyai.com` (3), `api.brevo.com` (2), `api.github.com` (2).
- Aucun ratchet de `check-rules.sh` ne gèle ces appels directs (le check [045] vérifie seulement l'import de `_shared/api-usage.ts`).
- Correction : reformuler « Un appel nouveau passe par `aiChat()` / par l'adaptateur `_shared/<tiers>.ts` » ; remplacer « jamais » dans le paradigme par « cible » ; ajouter en Deferred ou Open Questions la dette chiffrée (15 appels Anthropic directs, liste des tiers sans adaptateur) et, pour respecter AD-10, un ratchet correspondant.

### F2. Majeur : AD-10 « chaque règle a son check, joué avant chaque commit » est faux

- 70 règles `### [NNN]` dans `IMPROVEMENTS.md` ; 8 n'ont aucun check dans `scripts/check-rules.sh` : [002], [013], [022], [024], [029], [032], [033], [063].
- Deux d'entre elles sont citées par la spine comme garanties : [063] (AD-4, garde des fonctions `verify_jwt = false`, dont la Vérification est « revue manuelle ») et [024] (conventions UI, `useEntityAutoSave`).
- « Avant chaque commit » : il n'existe ni hook git (`core.hooksPath` vide, pas de `.husky/`, rien dans `.git/hooks`) ni script `prepare`. Le seul pré-commit est le hook PreToolUse de `.claude/settings.json` (lignes 36-42), qui ne couvre que les commits faits par Claude Code. Les commits Lovable sur `main` n'y passent pas ; seule la CI (`ci.yml:31`, sur push et PR) les rattrape, après coup.
- Correction : « Chaque règle nouvelle a son check ; 8 règles historiques ([002] [013] [022] [024] [029] [032] [033] [063]) restent en revue manuelle. `check-rules.sh` est joué en CI et en pré-commit des sessions Claude Code (hook `.claude/settings.json`), pas pour les commits Lovable. » Soit retirer [063] des garanties d'AD-4, soit lui créer un check.

### F3. Majeur : le décompte des buckets (Open Questions) ne correspond pas aux migrations

- Spine : « 21 buckets sur 25 sont publics ».
- Migrations (rejeu des `INSERT INTO storage.buckets` et `UPDATE storage.buckets SET public`) : 27 buckets créés, 22 publics, 5 privés (`signature-proofs`, `balance-sheets`, `meeting-recordings`, `tender-documents`, `vhd-attachments`).
- Un 28e bucket, `game-restock-files`, est utilisé (`supabase/functions/upload-game-restock-file/index.ts:9`, `src/hooks/useGameRestocks.ts:121,132`, listé dans `scheduled-backup/index.ts:127`) et a des policies (`supabase/migrations/20260720075833_d10c92e1-...sql`), mais aucune migration ne le crée : il a été créé hors migration, ce qui viole AD-8 tel qu'écrit.
- Si « 21/25 » vient de la base hébergée, la spine doit le dire (source et date) ; ce n'est pas vérifiable depuis le dépôt.
- Correction : « D'après les migrations, 22 buckets publics sur 27, plus `game-restock-files` créé hors migration (visibilité inconnue) ; état en base à relever. » Ajouter `game-restock-files` aux Open Questions au titre d'AD-8.

### F4. Moyen : AD-2 « jamais de policy `anon` sur une table » contredit [009], qu'elle cite

- [009] (`IMPROVEMENTS.md:634-640`) autorise les policies `anon` à condition qu'elles valident un token dans `USING` ; il ne les interdit pas.
- 4 migrations contiennent encore des `CREATE POLICY ... TO anon` (état effectif en base non vérifié : certaines ont pu être supprimées depuis).
- Les RPC `get_*_by_token` existent bien (10 : `get_attendance_by_token`, `get_questionnaire_by_token`, `get_evaluation_by_token`, etc.).
- Correction : soit aligner sur [009] (« une policy `anon` valide un token ; chemin préféré : RPC `get_*_by_token` »), soit assumer une règle plus stricte avec un nouveau numéro, son check et l'inventaire des policies `anon` restantes.

### F5. Moyen : Stack, sources de versions mélangées, Vitest faux

| Paquet | Spine | package.json | Installé (lock et node_modules) |
| --- | --- | --- | --- |
| React | 18.3.1 | ^18.3.1 | 18.3.1 |
| TypeScript | 5.8.3 | ^5.8.3 | 5.8.3 |
| Vite | 5.4.21 | ^5.4.19 | 5.4.21 |
| TanStack Query | 5.90.20 | ^5.83.0 | 5.90.20 |
| React Router (`react-router-dom`) | 6.30.4 | 6.30.4 | 6.30.4 |
| Tailwind CSS | 3.4.17 | ^3.4.17 | 3.4.17 |
| supabase-js | 2.110.0 | ^2.110.0 | 2.110.0 |
| **Vitest** | **4.0.18** | ^4.0.18 | **4.1.8** |
| Playwright (`@playwright/test`) | 1.58.2 | ^1.58.2 | 1.58.2 |
| Node (CI) | 20 | | `node-version: 20` dans `ci.yml:21,44`, `autofix-main.yml:42`, `demo-scan.yml:21` |

- Vite et TanStack reprennent la version installée, Vitest reprend le plancher déclaré.
- Correction : Vitest 4.1.8, et préciser en tête de tableau « versions résolues par `package-lock.json` ».

### F6. Moyen : AD-4 « CORS jamais `*` » n'est pas garanti par le code

- `supabase/functions/_shared/cors.ts:8` : `const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "*";`. Sans `APP_ORIGIN` en production, toutes les fonctions répondent `*`. Le check [008] (grep du littéral) ne voit pas ce repli.
- Non vérifiable statiquement : la présence de `APP_ORIGIN` dans les secrets du projet.
- Détail : `createJsonResponse` / `createErrorResponse` sont dans `_shared/cors.ts` (lignes 42, 70), pas dans `supabase-client.ts` ; la phrase de la spine est correcte mais ambiguë.
- Correction : « CORS via `_shared/cors.ts`, origine `APP_ORIGIN` (repli `*` si absent : à vérifier en production, ou retirer le repli) ».

### F7. Mineur : convention de nommage des edge functions inexacte

- `process-*` : 17 fonctions, toutes `verify_jwt = false` : conforme.
- `sync-*` : 0 fonction. Le réel est `*-sync` (`boamp-sync`, `gsc-sync`, `ted-sync`, `wp-statistics-sync`).
- `send-*` (37 fonctions, premier préfixe du dépôt) et `generate-*` (20) ne sont rattachés à aucune classe.
- Contexte utile pour AD-4 : 228 fonctions sur 243 sont en `verify_jwt = false`.
- Correction : remplacer `sync-*` par `*-sync` ; soit classer `send-*` / `generate-*`, soit dire que le nom ne détermine pas la classe et que seule la garde compte.

### F8. Mineur : AD-1 et AD-2, liste des fonctions d'accès et définition du staff

- Les 5 fonctions citées existent avec ces signatures : `is_staff_user()`, `is_admin(_user_id uuid)`, `has_module_access(_user_id uuid, _module text)`, `get_learner_email()`, `current_user_access_level()`.
- Il manque `is_known_learner(p_email text)` (`20260922100000_is_known_learner.sql`), que [062] désigne comme source unique du test « apprenant connu ». Elle est révoquée pour `anon` et `authenticated`, donc utilisable depuis les fonctions `SECURITY DEFINER` mais pas depuis une policy : à dire.
- AD-2 « Staff = `auth.users` + ligne `profiles` » : `is_staff_user()` exige `profiles.is_admin = true` OU au moins une ligne `user_module_access`. Une ligne `profiles` seule ne fait pas un staff.
- Correction : ajouter `is_known_learner()` avec cette réserve ; « Staff = `is_staff_user()` : `profiles.is_admin` ou au moins un accès module dans `user_module_access` ».

### F9. Mineur : AD-9, fichier d'exclusions des tables

- `scripts/backup-*-exclusions.txt` ne correspond qu'à `scripts/backup-bucket-exclusions.txt`. Les tables s'excluent dans `scripts/backup-exclusions.txt` (`check-backup-tables.sh:11`, [038]).
- Correction : citer les deux fichiers nommément.

### F10. Mineur : chiffres de la section Deferred

- « 145 contre 28 » : vérifié (145 hooks importent le client Supabase, 28 importent `@/services`).
- « 388 clés littérales » : méthode non indiquée, non reproduite (602 occurrences de `queryKey: [`, 185 racines littérales distinctes). Indiquer la commande ou retirer le chiffre.
- « seul `components/` l'est » : faux au sens strict, `src/hooks/crm/`, `src/hooks/participants/` et `src/lib/arena/` existent. Écrire « quasi uniquement `components/` ».

## Vérifié conforme

- Règles citées : [001] [004] [006] [008] [009] [014] [015] [017] [019] [020] [021] [023] [024] [026] [027] [030] [031] [034] [036] [037] [038] [042] [044] [045] [046] [047] [049] [050] [052] [054] [058] [059] [061] [062] [063] [065] [068] [069] existent toutes, sans doublon de numéro, et disent ce que la spine leur fait dire (hors les réserves de F2 et F4).
- `has_module_access()` : email en dur confirmé dans `20260202130645_ce85e69a-...sql:26-41` ; aucune redéfinition ultérieure, ni dans `migrations-apres-front/`.
- `scheduled-backup` : `verify_jwt = false` (`config.toml:270-271`) ; le handler (`index.ts:1400`) ne fait qu'un health check sur la clé anon puis crée un client service role sans `verifyAuth` ni `isInternalCall`. Open Question fondée. Même configuration pour `backup-export` (`config.toml:240-241`), à examiner aussi.
- Doc contradictoire : `docs/AUDIT_AVANT_PUSH.md:4` (et le paragraphe des lignes 10-14) affirme que pousser applique les migrations ; le README de `migrations-apres-front/` (correction du 18/09/2026) dit l'inverse, preuve `schema_migrations` à l'appui, cohérent avec AGENTS.md. Réserve : l'étape 3 du même README (« Pousser. ») reste ambiguë et mériterait « puis jouer explicitement ».
- `lot6c` : `20260915120000_lot6c_fermeture_entete_apprenant.sql` est bien dans `migrations-apres-front/`, et la dernière `get_learner_email()` de `supabase/migrations/` lit encore `x-learner-email` (`20260922100000_is_known_learner.sql:50`).
- Helpers edge : `getSupabaseClient()` et `verifyAuth()` (`_shared/supabase-client.ts:21,62`), `isInternalCall()` et `isInternalOrAuthenticated()` (`_shared/cron-auth.ts:23,44`), `aiChat()` (`_shared/ai.ts:171`), `_shared/claude-models.ts` (seul emplacement des ids Claude en code de production), `_shared/api-usage.ts`, `_shared/api-keys.ts`, `todayAsISO()` (`_shared/date-utils.ts:163`), `_shared/mime-types.ts`.
- Helpers front : `useEdgeFunction`, `toastError`, `reportHandledError` (`src/lib/sentry.ts`), `normalizeEmail` (`src/lib/stringUtils.ts`), `useDemoMode` (`src/contexts/DemoModeContext.tsx`), `src/lib/demoMask.ts`, `resolveContentType` (`src/lib/file-utils.ts`), `ModuleLayout`, `PageHeader`, `<Spinner />`, `useConfirm`, `useAutoSaveForm`, `useEntityAutoSave`, `todayAsISO` (`src/lib/dateFormatters.ts`), `RequireStaff` / `RequireLearner`, `useSession().status` ; `refetchOnWindowFocus: false` et `QueryCache` / `MutationCache` `onError` dans `src/App.tsx:152-168`.
- RLS : les 252 tables créées et non supprimées par les migrations ont toutes un `ENABLE ROW LEVEL SECURITY`.
- Tables du diagramme ER : toutes existent ; relations confirmées par les clés étrangères de `types.ts` (`crm_cards.linked_mission_id` pour `crm_cards` / `missions`). `mcp_oauth_records`, `api_usage_events`, `app_settings`, `user_module_access` existent.
- `project_id = "yewffntzgrdgztrwtava"` (`supabase/config.toml:1`). [054] : 243 sections `[functions.*]` pour 243 dossiers.
- CI : `ci.yml` (typecheck, check-rules, tests, smoke Playwright) et `rls-tests.yml` (PR sur `supabase/migrations/**` ou `supabase/tests/**`, plus `workflow_dispatch`). Réserve AD-8 : le rejeu sur base vierge de [042] est outillé par `scripts/replay-migrations.sh` ; le workflow `RLS tests` le prouve indirectement, et seulement sur les PR concernées.

## Non vérifiable depuis le dépôt

- « Pousser sur GitHub n'applique rien » : repose sur le constat en base du README (18/09/2026). Cohérent avec AGENTS.md, non reproductible statiquement.
- « 21 buckets sur 25 » s'il s'agit de l'état en base (voir F3).
- Présence de `APP_ORIGIN` en production (voir F6).
- « `types.ts` généré, jamais édité à la main » : aucune règle ni aucun check ne l'encadre ; c'est une convention, pas un invariant vérifié au sens d'AD-10.
