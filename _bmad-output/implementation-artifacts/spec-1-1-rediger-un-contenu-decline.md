---
title: 'Story 1.1 : rédiger un contenu décliné sur plusieurs canaux'
type: 'feature'
created: '2026-11-05'
status: 'in-progress'
baseline_commit: 'd41a0f4f8f1ecd5d25ebd608824cec12314004b3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/specs/spec-contenus-sociaux/statuts-et-validation.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Romain et Emmanuelle n'ont aucun endroit pour rédiger un contenu une seule fois et le décliner sur leurs comptes sociaux, le blog et Le Déclic.

**Approach:** Créer le sous-module « Contenus sociaux » dans supertilt.fr, avec deux parties :
- un modèle en base : 8 canaux, des groupes de contenu et un post par canal, la synchro du texte étant portée par la base ;
- un composeur multi-canaux avec sauvegarde continue.

**Décisions (Romain, 5 nov.) :**
- Les stories 1.1 à 1.6 s'accumulent sur la branche. Une seule PR sera ouverte, quand l'epic 1 sera utilisable.
- La colonne « Non planifiés » sort de cette story. Elle est reportée dans `deferred-work.md`, à livrer avec la story 1.2.

## Boundaries & Constraints

**Always:**
- Toutes les nouvelles tables ont la RLS `is_admin(auth.uid()) OR has_module_access(auth.uid(), 'supertilt_fr')` et figurent dans `TABLES_TO_BACKUP` de `scheduled-backup` et de `backup-export` (règle [038]).
- La migration est rejouable : `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, insertion des 8 canaux par `ON CONFLICT DO NOTHING` (règle [042]).
- Le format (post, story, reel) est une contrainte CHECK en base (règle [073]). Un groupe a au moins un canal.
- La propagation du texte dans un groupe synchronisé se fait en base, par une fonction SQL testée sur PGlite et inscrite dans `scripts/sql-tested-functions.txt` (règle [058]).
- Les données passent par page, puis hook, puis service (règle [014b]). Sauvegarde continue par `useAutoSaveForm` (règle [001]). Dialogue en `w-full sm:max-w-*` (règle [007]). Chargement par `<Spinner />`.
- Le `scheduled_at` est un `timestamptz` facultatif, saisi et affiché en heure de Paris.

**Never:**
- Pas de colonne « Non planifiés » (reportée), de calendrier (1.2), de visuel (1.3), de thème (1.4), de détail ni de marquage publié (1.5), de validation (epic 2).
- Pas d'édition manuelle de `src/integrations/supabase/types.ts` (règle [079]) : le service utilise ses propres types et un client non typé, jusqu'à la régénération par Lovable.
- Pas de modification des autres écrans de supertilt.fr.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Création multi-canaux | 3 canaux, texte, format post, sans date | 1 groupe, 3 posts liés, publication « sans date » | N/A |
| Synchro active | texte modifié dans un post d'un groupe synchronisé | les autres posts du groupe reçoivent le même texte | N/A |
| Synchro coupée | `sync = false`, texte d'une déclinaison modifié | seule cette déclinaison change | N/A |
| Aucun canal | enregistrement sans canal coché | refus | message « Choisissez au moins un canal » |
| Sauvegarde continue | fermeture du composeur sans clic sur Enregistrer | le contenu est déjà en base, en brouillon sans date | toast via `toastError` si l'écriture échoue |
| Sans droit | utilisateur sans `supertilt_fr`, hors admin | aucune ligne lue ni écrite | RLS |

</frozen-after-approval>

## Code Map

- `src/components/AppSidebar.tsx` (NAV_CONFIG, groupe `supertilt-fr`, l.44-51) -- ajouter l'enfant `{ key: "sf-contenus-sociaux", module: "supertilt_fr" }`.
- `src/components/moduleIcons.ts` (l.58-63) -- ajouter l'entrée `sf-contenus-sociaux` : libellé, icône, chemin.
- `src/App.tsx` (routes `/supertilt-fr/*`, l.283-288 ; `lazy` comme `Perles`, l.127) -- route et page en lazy.
- `src/pages/Perles.tsx`, `src/hooks/usePearls.ts`, `src/services/pearls.ts` -- modèle page, hook et service à suivre (`useQuery` et mutations qui invalident la clé).
- `src/hooks/useAutoSaveForm.ts` et `src/components/content/ContentCardDialog.tsx` (l.118-122, 149, 210, 276-281) -- API de la sauvegarde continue : `formValues` mémoïsé, `onSave` qui renvoie un booléen, `flushAndGetPending` à la fermeture.
- `supabase/migrations/20261104100000_client_pearls.sql` -- modèle de migration (RLS, trigger `updated_at`, idempotence).
- `supabase/functions/scheduled-backup/index.ts` (l.30) et `supabase/functions/backup-export/index.ts` (l.8) -- `TABLES_TO_BACKUP`, les deux listes sont identiques.
- `supabase/tests/helpers/db.ts` (`createTestDb`, `loadFunctions`, `actAs`) et `supabase/tests/support-ticket-number.test.ts` -- modèle de test de trigger sur PGlite.
- `src/lib/toastError.ts` -- `toastError` appelle déjà `reportHandledError`, ne pas appeler les deux.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261105120000_social_contents.sql` -- tables `social_channels` (nom, abréviation, limite de texte, ordre, actif), `social_content_groups` (format, synchro, auteur, dates) et `social_posts` (groupe, canal, texte, `scheduled_at`, `publication_status`) ; RLS ; trigger de propagation du texte ; 8 canaux insérés. -- Socle de l'epic.
- [ ] `supabase/functions/scheduled-backup/index.ts`, `supabase/functions/backup-export/index.ts` -- ajouter les 3 tables. -- Règle [038].
- [ ] `src/services/socialContents.ts` -- types locaux, `listChannels`, `getGroup`, `saveGroupWithPosts`. -- Seul point d'accès à Supabase.
- [ ] `src/hooks/useSocialContents.ts` -- requêtes et mutations React Query. -- Couche hook.
- [ ] `src/components/social/SocialComposerDialog.tsx` -- canaux à cocher, format, bascule de synchro, texte commun ou un onglet par canal, date et heure facultatives, sauvegarde continue. -- Composeur.
- [ ] `src/pages/SocialContentsPage.tsx`, plus la route, le menu et l'icône -- `ModuleLayout` et `PageHeader`, bouton « Nouveau contenu ». -- Sous-module.
- [ ] `supabase/tests/social-contents.test.ts`, `scripts/sql-tested-functions.txt` -- propagation avec synchro active et coupée, format refusé hors CHECK, RLS avec un compte autre que Romain. -- Règle [058].
- [ ] `src/services/socialContents.test.ts` -- construction des posts d'un groupe à partir des canaux cochés. -- Logique pure.

**Acceptance Criteria:**
- Given un utilisateur avec `supertilt_fr`, when il ouvre le menu supertilt.fr, then « Contenus sociaux » apparaît et mène à `/supertilt-fr/contenus-sociaux`.
- Given la migration rejouée deux fois, when on compte les canaux, then il y en a exactement 8.
- Given l'écran, when le mode démo est actif, then `scripts/check-demo-mask.sh` reste à 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Trois tables plutôt qu'une :
- le groupe porte ce qui est commun à toutes les déclinaisons : format, synchro, auteur ;
- le post porte ce qui est propre à un canal : texte quand la synchro est coupée, date, statut de publication.

C'est le modèle de Planable (`groupId`, `groupSync`). Il prépare la publication déclinaison par déclinaison (story 1.5) et la validation de tout le groupe (epic 2).

Un trigger `AFTER UPDATE OF text ON social_posts` recopie le texte vers les autres posts du groupe quand `sync = true`. Un garde `pg_trigger_depth() = 1` évite la récursion. Les trois comptes LinkedIn ont la même abréviation, « LI », avec le nom complet en infobulle, comme sur la maquette.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent, dont `social-contents.test.ts`
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
