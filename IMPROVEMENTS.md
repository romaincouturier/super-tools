# Règles d'amélioration continue

Ce fichier est géré automatiquement par la skill `/learn`.
Chaque règle est issue d'un constat fait pendant le développement — un bug, une question, un pattern identifié.
Ce ne sont pas des tickets : ce sont des **invariants** à vérifier en permanence.

---

## Duplication

### [003] Extraire getFileType() dans file-utils.ts — ne jamais dupliquer une fonction utilitaire
- **Constat** : La fonction `getFileType(file: File)` était dupliquée à l'identique dans `EntityMediaManager.tsx` et `MediaUploadDialog.tsx`. Le même bug (`file.type` au lieu de `resolveContentType()`) a dû être corrigé dans les deux fichiers.
- **Règle** : Toute fonction utilitaire doit exister en un seul exemplaire dans `src/lib/`. Si elle est copiée-collée, l'extraire immédiatement.
- **Vérification** : Chercher les fonctions définies dans plusieurs composants avec le même nom ou le même corps.
- **Fichiers de référence** : `src/lib/file-utils.ts`
- **Origine** : bug SVG non uploadable — même correction appliquée deux fois
- **Date** : 2026-03-20

## Architecture

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

### [020] Edge functions — toujours utiliser `useEdgeFunction()` pour invoquer une fonction Supabase
- **Constat** : `supabase.functions.invoke()` est appelé 107 fois dans 73 fichiers. Chaque caller réimplémente le même pattern : `useState(loading)` + `useState(result)` + try/catch + `toast` d'erreur + `setLoading(false)` en `finally`. Environ 30-40 lignes de boilerplate par invocation, avec des variations sur le format de réponse (`data.result` vs `data` vs réponse complète).
- **Règle** : Utiliser le hook `useEdgeFunction<T>(functionName, { errorMessage?, successToast?, silentOnError? })` depuis `@/hooks/useEdgeFunction`. Il retourne `{ loading, result, error, invoke, reset }`. Appeler `await invoke(body)` qui retourne `T | null` (null en cas d'erreur). Ne PAS appeler `supabase.functions.invoke` directement dans un composant/hook non dédié.
- **Exception** : les hooks dédiés à une fonction (ex: `useBackup.ts` qui invoque `backup-export` + `backup-import` en flow chaîné) peuvent rester inline si la logique dépasse ce que le hook générique gère. À garder <5% des cas.
- **Vérification** : `grep -rn 'supabase\.functions\.invoke' src/` hors `src/hooks/useEdgeFunction.ts` doit être ≤ quelques cas justifiés.
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
- **Vérification** : `grep -rEn 'Loader2[^>]*animate-spin' src/` hors `src/components/ui/spinner.tsx` doit être vide (migration progressive acceptée ; check staged-only pour le pré-commit).
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
- **Règle** : Toute nouvelle page authentifiée dans `src/pages/` DOIT utiliser `ModuleLayout` comme wrapper ET `PageHeader` avec icône et titre. Exceptions documentées : pages publiques (Auth, Signup, ResetPassword, ForcePasswordChange, Landing, PolitiqueConfidentialite, Emargement, Evaluation, Questionnaire, TrainerEvaluation, SponsorEvaluation, ReclamationPublic, SignatureConvention, SignatureDevis), pages learner (LearnerPortal, LearnerAccess, LmsCoursePlayer), wizard (Onboarding), pages d'erreur (NotFound, FormulaireRedirect), utilitaires (Screenshots, Index), et interfaces full-screen spécialisées avec header custom (AgentChat, ArenaDiscussion, ArenaSetup, ArenaResults, FormationDetail, MissionSummary, TrainingSummary, TrainingSupportPage).
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

### [007] Modales et dialogues — toujours `w-full sm:max-w-{size}` pour le mobile
- **Constat** : 11 modales (CRM, formations, onboarding) avaient des largeurs fixes (`max-w-2xl`, `max-w-lg`, etc.) sans `w-full` mobile. Sur un écran < 480px, la partie gauche était tronquée et le contenu inaccessible. Même problème sur les `SheetContent` (ex: Support `w-[480px]` sans `w-full`).
- **Règle** : Tout `DialogContent`, `AlertDialogContent` ou `SheetContent` doit utiliser `w-full sm:max-w-{size}`. Toute grille de formulaire (`grid-cols-2`, `grid-cols-3`) doit avoir un fallback mobile `grid-cols-1 sm:grid-cols-N`.
- **Vérification** : Chercher `DialogContent.*max-w-` et `SheetContent.*w-\[` sans `w-full` précédent. Chercher `grid-cols-[2-9]` sans `grid-cols-1 sm:` dans les composants formulaire.
- **Fichiers de référence** : tous les `DialogContent` dans `src/components/`
- **Origine** : modale ticket support tronquée sur mobile — audit de 11 modales
- **Date** : 2026-03-21

## Sécurité

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
