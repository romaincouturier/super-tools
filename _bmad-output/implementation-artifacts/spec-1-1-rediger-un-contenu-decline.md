---
title: 'Story 1.1 : rédiger un contenu décliné sur plusieurs canaux'
type: 'feature'
created: '2026-11-05'
status: 'done'
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
- [x] `supabase/migrations/20261105120000_social_contents.sql` -- tables `social_channels` (nom, abréviation, limite de texte, ordre, actif), `social_content_groups` (format, synchro, auteur, dates) et `social_posts` (groupe, canal, texte, `scheduled_at`, `publication_status`) ; RLS ; trigger de propagation du texte ; 8 canaux insérés. -- Socle de l'epic.
- [x] `supabase/functions/scheduled-backup/index.ts`, `supabase/functions/backup-export/index.ts` -- ajouter les 3 tables. -- Règle [038].
- [x] `src/services/socialContents.ts` -- types locaux, `listChannels`, `getGroup`, `saveGroupWithPosts`. -- Seul point d'accès à Supabase.
- [x] `src/hooks/useSocialContents.ts` -- requêtes et mutations React Query. -- Couche hook.
- [x] `src/components/social/SocialComposerDialog.tsx` -- canaux à cocher, format, bascule de synchro, texte commun ou un onglet par canal, date et heure facultatives, sauvegarde continue. -- Composeur.
- [x] `src/pages/SocialContentsPage.tsx`, plus la route, le menu et l'icône -- `ModuleLayout` et `PageHeader`, bouton « Nouveau contenu ». -- Sous-module.
- [x] `supabase/tests/social-contents.test.ts`, `scripts/sql-tested-functions.txt` -- propagation avec synchro active et coupée, format refusé hors CHECK, RLS avec un compte autre que Romain. -- Règle [058].
- [x] `src/services/socialContents.test.ts` -- construction des posts d'un groupe à partir des canaux cochés. -- Logique pure.

**Acceptance Criteria:**
- Given un utilisateur avec `supertilt_fr`, when il ouvre le menu supertilt.fr, then « Contenus sociaux » apparaît et mène à `/supertilt-fr/contenus-sociaux`.
- Given la migration rejouée deux fois, when on compte les canaux, then il y en a exactement 8.
- Given l'écran, when le mode démo est actif, then `scripts/check-demo-mask.sh` reste à 0.

## Implementation Notes

- Enregistrement atomique par la RPC `save_social_content_group` (SECURITY INVOKER, RLS appliquée), avec un identifiant de groupe fourni par le client : la sauvegarde continue réécrit le même groupe, sans doublon. Un canal décoché perd son post ; une déclinaison publiée n'est jamais réécrite.
- Choix faits faute d'indication dans la spec : une date saisie sans heure prend 09:00, visible dans le champ ; réactiver la synchro garde le texte de l'onglet actif ; limites YouTube (5 000) et Facebook (63 206) choisies.
- Aucun moyen de rouvrir un brouillon fermé tant que la colonne « Non planifiés » (reportée) n'existe pas ; le composeur accepte déjà un `groupId`.
- Test ajouté au contrôle : `src/components/social/SocialComposerDialog.test.tsx` couvre la ligne « Sauvegarde continue » du tableau (fermeture sans Enregistrer).
- À faire pour la mise en production : jouer la migration explicitement, puis laisser Lovable régénérer `types.ts` et retirer le client non typé du service.

## Spec Change Log

## Review Triage Log

Passe 1 (5 nov.), trois couches : chasseur à l'aveugle, chasseur de cas limites, trous de vérification.

| # | Constat | Verdict | Preuve et décision |
|---|---|---|---|
| 1 | Le DELETE de la RPC supprime une déclinaison publiée quand on décoche son canal | medium | Le DELETE n'a pas le filtre `publication_status <> 'published'` que l'upsert a. Corrigé (patch). |
| 2 | La modification d'un post publié se propage aux autres déclinaisons du groupe | low | Le trigger ne regarde pas `NEW.publication_status`. Contraire à la décision sur les contenus partiellement publiés. Corrigé (patch). |
| 3 | Tout utilisateur `supertilt_fr` peut modifier la liste des canaux | medium | Les policies INSERT, UPDATE et DELETE ne sont pas réservées aux admins, alors qu'aucun écran ne gère cette donnée de référence. Restreint aux admins (patch). |
| 4 | `social_contents_touch_updated_at` double `update_updated_at_column` | low | La fonction existe déjà dans les migrations. Réutilisée (patch). |
| 5 | Index `social_posts_group_idx` redondant | low | Il est couvert par la colonne de tête de la contrainte unique. Supprimé (patch). |
| 6 | Re-sauvegarde avec synchro ou format changés non testée | medium | Trou de vérification déjà vérifié par la couche. Test ajouté (patch). |
| 7 | Protection des posts publiés non testée côté RPC | medium | Trou de vérification déjà vérifié par la couche. Test ajouté (patch). |
| 8 | Groupe en erreur ou introuvable initialisé vide, puis la sauvegarde continue efface ses posts | medium | `groupFetching` passe à false alors que `group` est absent, et l'id existant est conservé. Garde ajoutée (patch). |
| 9 | À la réouverture, le texte commun est pris d'un post publié | low | `posts[0]` peut être publié. Corrigé (patch). |
| 10 | Des sauvegardes peuvent se croiser | medium | Rien n'attend la mutation en cours. Les sauvegardes sont mises en file (patch). |
| 11 | Une sauvegarde échouée puis la fermeture perdent la saisie | medium | Après un échec, `flushAndGetPending` renvoie null : rien n'est retenté. La fermeture retente (patch). |
| 12 | Un texte saisi sans canal est perdu sans avertissement | low | `handleAutoSave` renvoie false sans prévenir. Toast ajouté (patch). |
| 13 | Réactiver la synchro écrase les textes par canal sans prévenir | medium | `toggleSync(true)` ne garde que l'onglet actif. Confirmation `useConfirm` ajoutée (patch). |
| 14 | Une heure effacée s'enregistre à 09:00 alors que le champ affiche vide | low | `toDraft` applique `DEFAULT_TIME`. Le champ est remis à 09:00 (patch). |
| 15 | Enregistrer et le passage de la date à `scheduledAt` non testés dans le composeur | medium | Trou de vérification déjà vérifié par la couche. Test ajouté (patch). |
| 16 | Les heures de changement d'heure (inexistante, ambiguë) ne sont pas testées | low | Saisie rare mais possible. Tests ajoutés pour fixer le comportement (patch). |
| 17 | La page ne permet pas de rouvrir un brouillon | false | Exclu par l'intention : la colonne « Non planifiés » est reportée dans `deferred-work.md`. |
| 18 | `text_limit` chargé mais non utilisé | false | Les alertes de longueur appartiennent à la story 1.3, exclue par l'intention. |
| 19 | Trois canaux partagent l'abréviation LI | false | C'est la décision de la maquette, inscrite dans la spec. |
| 20 | `created_by` modifiable en écriture directe | low | Aucun écran ne l'expose ; le défaut est rare et la garde ajouterait de la complexité. Rejeté. |
| 21 | Posts sur un canal désactivé, invisibles mais conservés | low | Aucun écran ne désactive de canal (et c'est réservé aux admins depuis le n° 3). Rejeté. |
| 22 | Chaque sauvegarde continue relit le groupe ouvert | low | Coût négligeable, aucun effet visible, protégé par `initializedFor`. Rejeté. |
| 23 | Doublon de canal dans `p_posts` : résultat non déterministe | low | Le client dédoublonne déjà (`buildGroupPosts`). Rejeté. |
| 24 | Le garde `pg_trigger_depth` ignore les écritures faites depuis un autre trigger | maybe-false | Aucun autre trigger n'écrit dans `social_posts` aujourd'hui. Rejeté : l'enjeu serait faible. |

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
