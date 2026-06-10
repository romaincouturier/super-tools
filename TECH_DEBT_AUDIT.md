# Audit de dette technique — Super Tools

Date : 2026-06-10. Périmètre : `src/` (194k LOC hors `components/ui`), `supabase/functions/` (212 fonctions, 52k LOC), `supabase/migrations/` (523 fichiers), dépendances, docs.
Méthode : 3 passes parallèles (frontend, backend Supabase, transverse) + outillage (`npm audit`, `madge`, `tsc`, `rg`).

## Résumé exécutif

1. **CORS wildcard en production** : `_shared/cors.ts:9` exporte `Access-Control-Allow-Origin: *` vers ~150 fonctions. Violation directe de la règle [008]. Correctif en 1 fichier.
2. **204 edge functions en `verify_jwt = false`** : l'auth repose sur des checks applicatifs (`verifyAuth()`) que chaque auteur doit penser à appeler. Plusieurs fonctions cron (`send-booking-reminder`, `process-scheduled-emails`) n'ont ni JWT ni secret.
3. **2 fonctions absentes de `config.toml`** : `send-group-matching-email` et `fireflies-backfill-range` existent dans le répertoire mais ne sont pas déclarées — elles ne seront pas déployées avec leurs réglages.
4. **23 vulnérabilités npm** dont 3 critical (jsPDF : injection JS arbitraire dans les PDF générés ; vitest UI : lecture de fichiers arbitraires).
5. **Règle [014] violée à grande échelle** : appels `supabase.from()` directs dans 10+ pages et ~62 composants, malgré la règle documentée et le check-rules.
6. **259 `as any` dans 87 fichiers src**, concentrés dans les hooks dont les tables manquent au schéma généré (`useGroupMatching`, `BPFReport`, `useLearnerPortalData`). Cause racine : `types.ts` non régénéré après les migrations récentes.
7. **7 god files > 1000 LOC** (`LearnerPortal.tsx` 2101, `SupertiltOrders.tsx` 1608, `MissionPages.tsx` 1469…) qui mélangent data, état et rendu.
8. **89 fonctions recréent leur client Supabase** au lieu d'utiliser `_shared/supabase-client.ts` qui existe et cache l'instance.
9. **Docs cassées** : ~100 liens absolus Windows (`C:\Users\coutu\…`) dans README, CONTRIBUTING, SECURITY, docs/architecture.md.
10. **Double système de toast** : sonner (52 imports) + Radix use-toast (193 imports) coexistent ; `@testing-library/dom` est en `dependencies` au lieu de `devDependencies`.

## Modèle mental de l'architecture

Monolithe SaaS multi-modules (formations, CRM, missions, LMS, support, événements, OKR, veille, IA) : React 18 + Vite + TanStack Query côté front, Supabase (Postgres + RLS + 212 edge functions Deno) côté back. L'architecture cible documentée (`docs/architecture.md`) est Pages → Composants → Hooks → Services → Lib, avec un système de règles vivantes (`IMPROVEMENTS.md` + `scripts/check-rules.sh`, 35 checks) qui constitue un vrai garde-fou — rare et précieux.

La réalité diverge sur deux axes : (1) la couche services (33 fichiers) est contournée par la majorité des hooks, et les composants/pages contournent eux-mêmes les hooks dans ~70 endroits ; (2) le modèle de sécurité est « single-tenant trust » — tout utilisateur authentifié a accès à presque tout via `USING (true)`, et les edge functions désactivent massivement la vérification JWT du framework au profit de checks applicatifs. C'est un choix assumé (documenté dans `cleanup-baseline.md`) mais fragile : chaque nouvelle fonction est sûre seulement si son auteur pense à `verifyAuth()`. L'historique git (~50 % de commits « Changes », héritage Lovable) rend la traçabilité des décisions difficile.

## Tableau des findings

| ID | Catégorie | Fichier:Ligne | Sévérité | Effort | Description | Recommandation |
|----|-----------|---------------|----------|--------|-------------|----------------|
| S1 | Sécurité | `supabase/functions/_shared/cors.ts:9` | Critical | S | `Access-Control-Allow-Origin: *` propagé à ~150 fonctions (règle [008]) | Lire le domaine depuis une env var, fallback `*` en dev uniquement |
| S2 | Sécurité | `supabase/config.toml` (204 entrées) | Critical | L | `verify_jwt = false` quasi-systématique ; l'auth dépend de checks applicatifs optionnels | Auditer fonction par fonction : publique (webhook/token), cron (secret partagé), ou `verify_jwt = true` |
| S3 | Sécurité | `supabase/functions/send-booking-reminder/index.ts`, `process-scheduled-emails/index.ts` | High | M | Fonctions cron déclenchables par n'importe qui : envoi d'emails en masse, lecture de données formateurs | Exiger un header secret (CRON_SECRET) vérifié en tête de fonction |
| S4 | Sécurité | `supabase/functions/search-siren-by-name/index.ts:20-35` | High | S | Lit `insee_api_key`, `google_search_api_key` depuis `app_settings` sans auth | Ajouter `verifyAuth()` avant la lecture des clés |
| S5 | Sécurité | `supabase/functions/supertilt-webhook/index.ts`, `pictodico-webhook/index.ts` | High | M | Webhooks sans validation de signature visible (contrairement à fireflies/stripe qui valident) | Ajouter un secret partagé ou une signature HMAC |
| S6 | Sécurité | migrations, 131 policies `TO anon USING (true)` (ex. `20260308224610:253-261`, `20260601140000_mission_surveys.sql:69-70`) | High | M | Policies anon sans validation de token (règle [009]) : insert quiz attempts, bookings, survey responses sans scope | Auditer chaque policy anon ; exiger un token de session dans le WHERE |
| S7 | Sécurité | `package.json` — jsPDF ≤4.2.0 | Critical | S | CVE critical : exécution JS arbitraire via AcroForm dans les PDF générés (devis, conventions) | `npm audit fix` puis vérifier la génération PDF |
| S8 | Sécurité | `package.json` — vitest 4.0.x | Critical | S | CVE critical : vitest UI permet lecture/exécution de fichiers arbitraires | `npm audit fix` (dev-only mais à corriger) |
| S9 | Sécurité | `supabase/functions/rag-chatbot/`, `arena-*`, `search-siren*` | Medium | M | Aucun rate limiting sur les endpoints publics consommant des API payantes (OpenAI, INSEE) | Rate limiter par IP/user (table Supabase ou middleware) |
| S10 | Sécurité | 88 migrations avec `WITH CHECK (true)` (ex. `20260204100000_create_crm_module.sql:128-213`, `20260204240000_create_okr_module.sql:118-186`) | Medium | L | Tout utilisateur authentifié peut écrire dans CRM, OKR, etc. Design single-tenant assumé mais non documenté formellement | Documenter l'hypothèse single-tenant ; bloquer si du multi-tenant arrive |
| A1 | Architecture | `src/pages/Reclamations.tsx:144,171`, `Admin.tsx:79-92`, `TimeTracker.tsx:148,375,390,559`, `MicroDevis.tsx:337`, `FormationEdit.tsx:289`, `PictoDico.tsx:121,135,306`, `Evaluations.tsx:224`, `InboundEmails.tsx:111` | High | L | Appels Supabase directs dans les pages — violation règle [014] | Extraire en hooks de mutation ; ajouter un check dans `check-rules.sh` |
| A2 | Architecture | ~62 occurrences dans `src/components/` (ex. `crm/reports/ProvenanceTab.tsx`, `quotes/Step5Email.tsx`, `content/CommentThread.tsx`, `transcripts/TranscriptGenerationPanel.tsx`) | High | L | Composants UI avec accès données direct | Même traitement que A1, par module |
| A3 | Architecture | `src/pages/LearnerPortal.tsx` (2101), `SupertiltOrders.tsx` (1608), `components/missions/MissionPages.tsx` (1469), `pages/LmsCourseHomePage.tsx` (1245), `BPFReport.tsx` (1160), `components/supertilt/SupertiltOrdersV2.tsx` (1101), `formations/ScheduledEmailsSummary.tsx` (1071) | High | L | God files mélangeant data + état + rendu | Découper au fil des prochaines features touchant ces fichiers (pas de big-bang) |
| A4 | Architecture | `src/hooks/useArenaDiscussion.ts` (1037), `useSupertiltOrders.ts` (1031), `usePracticeFeed.ts` (783), `useTrainingSupport.ts` (751), `useFormationDetail.ts` (631), `useLmsQueries.ts` (614) | Medium | L | Hooks monolithiques > 600 LOC (seuil projet : ~300) | Splitter par domaine au prochain passage |
| A5 | Architecture | `src/services/` vs hooks (ex. `useLmsQueries.ts` ignore `services/lms-blocks.ts`) | Medium | M | Couche services existante mais contournée — 2 imports sur 24 pour `services/missions.ts` | Trancher : soit la couche services est obligatoire (l'imposer), soit hooks→Supabase est le standard (supprimer les services orphelins) |
| A6 | Architecture | `src/pages/LearnerPortal.tsx:82-115` | Low | S | Hook `useRecommendedCourses` défini inline dans la page | Déplacer vers `src/hooks/` |
| A7 | Architecture | `src/components/supertilt/SupertiltOrdersV2.tsx` | Low | S | Nom trompeur : contient les onglets V2+V3 (Bilan, Partenaires, Dépenses, Stock, Auteurs) | Renommer `SupertiltOrderTabs.tsx` |
| T1 | Types | 259 `as any` dans 87 fichiers ; clusters : `src/hooks/useGroupMatching.ts` (26), `useDropshipping.ts` (11), `useTrainingSurveys.ts` (10), `pages/BPFReport.tsx:37` (`const bpfDb = supabase as any`) | High | M | Cause racine : tables absentes du `types.ts` généré | Régénérer `types.ts` depuis le schéma (`supabase gen types`), puis supprimer les casts mécaniquement |
| T2 | Types | `src/hooks/useLearnerPortalData.ts:80-111`, `pages/FailedEmails.tsx`, `components/settings/UserAccessManager.tsx` | Medium | M | `as any[]` et `useState<any[]>` sur des flux de données métier | Typer après régénération T1 |
| D1 | Données | `src/components/quotes/Step5Email.tsx`, `content/KanbanBoard.tsx`, `content/CommentThread.tsx` | High | M | Mutations sans `invalidateQueries` → données obsolètes affichées après écriture | Envelopper en `useMutation` avec invalidation |
| D2 | Données | `src/hooks/useLmsQueries.ts:308` (`["lms-course-lessons", courseId]`) vs `useLmsMutations.ts:154,175,195,209,263,282,307` (`["lms-course-lessons"]`) | Medium | M | Query keys incohérents entre queries et mutations du même domaine | Fichier de constantes de query keys par domaine |
| D3 | Données | `src/components/formations/ScheduledEmailsSummary.tsx:113-192`, `pages/Admin.tsx:71-102`, `pages/Reclamations.tsx:99-120` | Medium | M | Fetch manuel en `useEffect` au lieu de React Query (pas de retry, dédup, ni cache) | Migrer vers `useQuery` |
| P1 | Performance | `src/pages/Admin.tsx:87-100` | High | M | Boucle `for…await` sur les orgs : 4N requêtes au lieu d'un batch | Une requête par table avec `in("org_id", ids)` puis regroupement côté client |
| P2 | Performance | `src/hooks/useModuleAccess.ts` | Medium | S | 32 appels RPC `has_module_access` en parallèle à chaque check | RPC unique retournant tous les accès, ou cache long |
| B1 | Backend | `supabase/config.toml` — `send-group-matching-email` et `fireflies-backfill-range` absents | High | S | Fonctions présentes dans le répertoire mais non déclarées → non déployées avec leurs réglages | Ajouter les 2 entrées (vérifié : 212 dossiers, 209 déclarés + `_shared`) |
| B2 | Backend | 89 fonctions avec `createClient(...)` local (ex. `backup-export/index.ts:138`, `send-booking-reminder/index.ts:138`, `fireflies-webhook/index.ts:79`) | Medium | L | `_shared/supabase-client.ts` (client caché) existe mais inutilisé | Remplacement mécanique au fil de l'eau ; check-rules possible |
| B3 | Backend | ~46 fonctions avec `.catch(() => {})` (ex. `agent-chat/index.ts` sur `storeCachedEmbedding`) | Medium | S | Erreurs avalées silencieusement sur des tâches background | Minimum : `.catch(e => console.warn(...))` |
| B4 | Backend | ~60 fonctions avec blocs de réponse CORS inline au lieu de `createJsonResponse()` | Low | L | Incohérence de pattern, pas de bug | Uniformiser opportunistement |
| B5 | Backend | `supabase/functions/search-siren/index.ts:92` | Low | S | HTTP 200 retourné sur erreur API INSEE (hack UX anti-toast Lovable) | Retourner 503 et gérer côté client |
| B6 | Backend | `supabase/functions/check-daily-actions-completion/index.ts:82,257` lit `train_booked` etc. sans fallback checklist, contrairement à `_shared/daily-data-fetchers.ts:946-1019` qui a le dual-read | Medium | M | Incohérence : une fonction sur le dual-read, l'autre sur les booléens seuls | Aligner sur le pattern dual-read, puis planifier la fin de vie des booléens |
| B7 | Backend | `_shared/daily-data-fetchers.ts:1035-1065` — les events n'ont pas de checklist logistique | Low | M | Events toujours sur booléens legacy uniquement | Décider : étendre la checklist aux events ou acter l'exception |
| X1 | Dépendances | `package.json:50` — `@testing-library/dom` en `dependencies` | Medium | S | Lib de test dans le bundle de prod | Déplacer en `devDependencies` |
| X2 | Dépendances | `package.json` — sonner (52 imports) + `@radix-ui/react-toast`/`use-toast` (193 imports) | Medium | M | Deux systèmes de toast actifs simultanément | Trancher pour l'un (use-toast est majoritaire et porté par `toastError()`), migrer l'autre |
| X3 | Dépendances | `npm audit` : 23 vulnérabilités (3 critical, 11 high) — dompurify, esbuild, @remix-run/router, flatted, glob… | High | S | Voir S7/S8 pour les critical | `npm audit fix` + test de non-régression build |
| TS1 | Tests | `src/hooks/useArenaDiscussion.ts` (1037 LOC), `useSupertiltOrders.ts` (1031), `useTrainingSupport.ts` (751) — zéro test | High | M | Les 3 plus gros hooks métier n'ont aucun test (62 fichiers de test pour ~400 fichiers src) | Squelettes de tests sur la logique pure (calculs, transformations) en mockant le client |
| TS2 | Tests | `src/components/crm/CardDetailDrawer.tsx` (942), `NewOpportunityDialog.tsx` (842), `pages/LearnerPortal.tsx` | Medium | L | Chemins critiques CRM/learner sans tests | Tests d'intégration au prochain refactor |
| DOC1 | Docs | `README.md:19,78`, `docs/architecture.md:31-47`, `docs/cleanup-baseline.md`, `CONTRIBUTING.md`, `SECURITY.md` — ~100 liens `C:\Users\coutu\…` | Medium | S | Liens absolus Windows cassés partout | Find/replace vers chemins relatifs |
| DOC2 | Docs | `docs/cleanup-baseline.md:4` daté 2026-04-03 | Low | S | Métriques de référence périmées (35 tests → 62, 126 fonctions → 212) | Régénérer la baseline |
| DOC3 | Docs | `src/i18n/` — 7 imports `useTranslation` dans toute l'app | Low | S | Infrastructure i18n configurée (fr+en) mais abandonnée | Supprimer i18next ou décider de l'activer (l'app est 100 % français) |

## Top 5 — si vous ne corrigez que ça

### 1. CORS wildcard (S1) — 30 min
```ts
// _shared/cors.ts
const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "*";
export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  ...
};
```
Un seul fichier, ~150 fonctions corrigées d'un coup. Définir `APP_ORIGIN` dans les secrets Supabase.

### 2. config.toml drift (B1) — 10 min
```toml
[functions.send-group-matching-email]
verify_jwt = false

[functions.fireflies-backfill-range]
verify_jwt = false
```
`send-group-matching-email` est une feature récente en production côté code — si elle n'est pas déclarée, son déploiement dépend du comportement par défaut.

### 3. Secret cron sur les fonctions d'envoi (S3) — 1 h
```ts
// En tête de send-booking-reminder, process-scheduled-emails, generate-daily-agenda…
const secret = req.headers.get("x-cron-secret");
if (secret !== Deno.env.get("CRON_SECRET")) {
  return new Response("Forbidden", { status: 403 });
}
```
Puis ajouter le header dans les définitions pg_cron. Bloque le déclenchement d'envois de masse par un tiers.

### 4. Régénérer types.ts et purger les `as any` (T1) — ½ journée
```bash
supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
```
Puis suppression mécanique des `(supabase as any)` dans `useGroupMatching.ts`, `useDropshipping.ts`, `BPFReport.tsx`, etc. Réactive le typage sur ~10 modules récents d'un coup. Ajouter une étape de CI qui échoue si le diff de types est non vide après régénération.

### 5. npm audit fix (S7/S8/X3) — 1 h
```bash
npm audit fix && npm run build && npx tsc --noEmit
```
jsPDF est utilisé pour générer des documents remis à des tiers (devis, conventions) — la CVE d'injection JS dans les PDF est le risque le plus concret de la liste.

## Quick wins (effort S × sévérité Medium+)

- [ ] S1 — CORS env-based dans `_shared/cors.ts`
- [ ] B1 — Déclarer les 2 fonctions manquantes dans `config.toml`
- [ ] S4 — `verifyAuth()` avant lecture d'`app_settings` dans `search-siren-by-name`
- [ ] S7/S8/X3 — `npm audit fix`
- [ ] X1 — `@testing-library/dom` → devDependencies
- [ ] B3 — Logger les erreurs dans les `.catch(() => {})` (46 occurrences, sed-able)
- [ ] DOC1 — Find/replace des chemins Windows dans les 6 docs
- [ ] P2 — RPC unique pour `useModuleAccess` (32 appels → 1)
- [ ] A6 — Extraire `useRecommendedCourses` de `LearnerPortal.tsx`
- [ ] Ajouter un check `[014b]` dans `check-rules.sh` : refuser tout nouveau `supabase.from(` dans `src/pages` et `src/components` (whitelist de l'existant pour ne pas bloquer)

## Ce qui a l'air problématique mais ne l'est pas

1. **Le dual-read logistique** (`_shared/daily-data-fetchers.ts:896-1069`) — lire la checklist d'abord, fallback sur les booléens legacy : c'est un pattern de dépréciation correct, pas de la dette. La dette serait de ne jamais le terminer (voir B6).
2. **Les fonctions d'upload sans try/catch** (`upload-support-attachment` et 8 autres) — elles délèguent à `_shared/upload-handler.ts:87-180` qui valide, vérifie l'écriture et rollback le storage. C'est une bonne abstraction, pas une absence de gestion d'erreur.
3. **`resend.ts` qui ne throw pas** — retourner `{success: false}` au lieu de throw est volontaire : un email raté ne doit pas faire planter un batch. Les appelants vérifiés checkent bien `result.success`.
4. **Les `(supabase as any)` commentés** type `useGroupMatching.ts` — symptôme, pas faute : le pattern documenté en attendant la régénération des types. Le vrai fix est T1, pas la chasse aux casts un par un.
5. **`USING (true)` sur les tables staff** — dans un produit mono-organisation où tous les utilisateurs authentifiés sont des collègues de confiance, c'est défendable. Ça devient critique le jour où un deuxième tenant arrive (voir question 1 ci-dessous).
6. **Les commentaires de section dans les god files** (`LearnerPortal.tsx`, `BPFReport.tsx`) — ce sont des repères structurels, pas du code mort.

## Questions ouvertes pour le mainteneur

1. **Multi-tenant : un jour, jamais ?** Les 380+ policies `USING (true)` et le modèle « tout utilisateur authentifié voit tout » sont OK en single-tenant. Si une ouverture multi-organisation est envisagée à 12 mois, le chantier RLS doit commencer maintenant.
2. **Couche services : obligatoire ou abandonnée ?** `src/services/` (33 fichiers) est contournée par la plupart des hooks. Faut-il l'imposer (et l'ajouter aux règles) ou la dissoudre dans les hooks ?
3. **Les 131 policies `TO anon`** couvrent-elles uniquement les parcours apprenants token-based prévus par la règle [009], ou certaines sont-elles des restes ? Un audit ciblé demanderait à croiser avec les flows learner réels.
4. **sonner vs use-toast** : lequel est le standard ? use-toast domine (193 vs 52) et porte `toastError()`, mais sonner est plus récent. À trancher avant toute migration.
5. **i18n** : l'anglais est-il prévu ? Sinon, i18next et `src/i18n/` peuvent partir.
6. **`search-siren` HTTP 200 sur erreur** : le hack anti-toast Lovable est-il encore nécessaire maintenant que le front gère `toastError()` ?
