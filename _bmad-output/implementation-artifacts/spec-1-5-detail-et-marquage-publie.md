---
title: 'Story 1.5 : ouvrir un contenu, le modifier et le marquer publié'
type: 'feature'
created: '2026-11-06'
status: 'in-progress'
baseline_commit: '4a0e0eab07510319d99525c48f35156668475e0d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/specs/spec-contenus-sociaux/statuts-et-validation.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-themes-et-filtres.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le calendrier ne sait pas ce qui est réellement sorti : rien ne permet de marquer une déclinaison publiée, ni de supprimer un contenu devenu inutile.

**Approach:**
- Le clic sur une carte ouvre déjà le composeur sur le contenu : il devient le détail, avec pour chaque déclinaison un bouton « Marquer publié » / « Annuler le marquage » et une action de suppression.
- Le marquage et l'annulation passent par une fonction SQL qui ne touche qu'une déclinaison.
- Une déclinaison publiée reste modifiable sur elle seule : son texte et son visuel s'éditent dans son onglet, sans jamais être réécrits par la synchro ni par une modification du groupe.
- La suppression, confirmée, retire la déclinaison de l'onglet actif ou tout le contenu.

## Boundaries & Constraints

**Always:**
- Marquer publié vaut pour une seule déclinaison : `publication_status = 'published'`, les autres déclinaisons ne changent pas. L'annulation remet `scheduled` si la déclinaison a une date, `unscheduled` sinon (1.5-SQL-001, 002).
- « Marquer publié » n'est proposé que pour une déclinaison déjà enregistrée et datée (« Given un post programmé ») ; sans date, le bouton est désactivé avec l'indication « Planifiez une date pour marquer publié ».
- Une déclinaison publiée garde sa date : le changement de date du groupe (composeur ou glisser-déposer) et la synchro du texte et du visuel l'ignorent, comme depuis la story 1.1 (1.5-SQL-003, comportement Q-2).
- Édition d'une déclinaison publiée : son onglet affiche son propre texte et son propre visuel, même quand la synchro est active, avec la mention « Publié, modifié seul ». L'enregistrement passe par une fonction SQL dédiée qui met à jour cette seule ligne, sans propagation. Le canal d'une déclinaison publiée ne peut pas être décoché.
- Suppression : `useConfirm()` (règle [021]). Deux choix : « Supprimer cette déclinaison » (onglet actif, publiée ou non) et « Supprimer tout le contenu ». Annuler ne supprime rien. Supprimer la dernière déclinaison supprime le groupe ; supprimer le groupe supprime ses déclinaisons (cascade existante) (1.5-SQL-004, 1.5-COMP-002).
- Les fonctions SQL restent SECURITY INVOKER, s'appuient sur la RLS existante, et sont testées sur PGlite (règle [058]).
- Le statut affiché reste calculé par `groupDisplayStatus` : un contenu partiellement publié affiche le statut le moins avancé.

**Never:**
- Pas de date de publication réelle distincte, pas d'historique des marquages, pas d'archivage (epic 2 ou plus tard).
- Pas d'édition manuelle de `types.ts` (règle [079]).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Marquer | LI et IN programmés, marquer LI | LI publié, IN programmé ; carte « Programmé » | N/A |
| Tout publié | LI et IN marqués | carte « Publié » | N/A |
| Annuler, daté | LI publié et daté, annuler | LI programmé, date conservée | N/A |
| Annuler, sans date | ligne publiée sans date (donnée existante), annuler | LI sans date | N/A |
| Sans date | déclinaison non datée | bouton désactivé avec indication | N/A |
| Éditer une publiée | LI publié, synchro active, texte LI modifié | seul LI change ; IN garde le texte commun | N/A |
| Synchro après marquage | LI publié, texte commun modifié | IN change, LI intact | N/A |
| Supprimer une déclinaison | 3 déclinaisons, supprimer IN | 2 restent, groupe conservé | N/A |
| Supprimer la dernière | 1 déclinaison, la supprimer | groupe supprimé, carte disparue | N/A |
| Supprimer le contenu | groupe de 3 déclinaisons dont une publiée | tout est supprimé | N/A |
| Annuler la confirmation | clic Supprimer puis Annuler | rien n'est supprimé | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261106110000_social_themes.sql` -- dernière version de `save_social_content_group` (ne réécrit jamais une publiée, ne supprime jamais une publiée) ; `20261105120000_social_contents.sql` -- trigger `social_posts_propagate_text` (ignore une ligne publiée en source comme en cible), cascade `group_id ... ON DELETE CASCADE`, policies `social_posts_module_delete` et `social_content_groups_module_delete`.
- `20261105130000_social_group_date.sql` -- `set_social_group_date` ne touche que les non publiées.
- `supabase/tests/social-contents.test.ts` -- harnais PGlite (`actAs`, EMMA hors Romain, OTHER sans droit, admin, anon).
- `scripts/sql-tested-functions.txt` -- y inscrire les nouvelles fonctions.
- `src/services/socialContents.ts` -- `getGroup`, `saveGroupWithPosts`, `buildGroupPosts`, `groupDisplayStatus`, `alertsByChannel`.
- `src/hooks/useSocialContents.ts` -- `SOCIAL_CONTENTS_KEY`, mutations existantes.
- `src/components/social/SocialComposerDialog.tsx` -- initialisation depuis le groupe (vers la ligne 195, `reference` = première non publiée), `publishedChannelIds` (vers la ligne 291), onglets par canal, autosave via `useAutoSaveForm` (règle [001]).
- `src/hooks/useConfirm.tsx` -- confirmation ; `src/lib/toastError`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261107100000_social_post_publication.sql` -- `set_social_post_published(p_post_id, p_published)`, `update_social_post_content(p_post_id, p_text, p_media_id)`, trigger de suppression du groupe vide. -- Socle.
- [ ] `supabase/tests/social-contents.test.ts` -- matrice SQL : marquage, annulation datée et non datée, édition d'une publiée sans propagation, synchro après marquage, suppressions, RLS des deux fonctions (sans droit, anon). -- Règle [058].
- [ ] `src/services/socialContents.ts` et `src/hooks/useSocialContents.ts` -- `setPostPublished`, `updatePublishedPost`, `deletePost`, `deleteGroup` et leurs hooks, invalidation des contenus. -- Service.
- [ ] `SocialComposerDialog.tsx` -- barre de déclinaison dans chaque onglet : statut, bouton de marquage, suppression ; onglet d'une publiée en édition propre ; canal publié non décochable ; « Supprimer tout le contenu » dans le pied du dialogue. -- Détail.
- [ ] Tests composant -- détail ouvert avec tous les champs (1.5-COMP-001), marquage et annulation, bouton désactivé sans date, édition d'une publiée, suppression confirmée et annulée avec le bon choix transmis (1.5-COMP-002). -- Couverture.

**Acceptance Criteria:**
- Given une carte du calendrier, when l'utilisateur clique dessus, then le détail s'ouvre avec texte, visuel, canaux, thème, format, date et heure, modifiables.
- Given une déclinaison programmée, when l'utilisateur la marque publiée, then elle seule passe « Publié », elle reste modifiable, et un second geste annule le marquage.
- Given un contenu, when l'utilisateur supprime une déclinaison ou tout le contenu et confirme, then seule la cible est supprimée ; sans confirmation rien ne l'est.

## Implementation Notes

- `set_social_post_published(p_post_id uuid, p_published boolean)` : `UPDATE social_posts SET publication_status = CASE WHEN p_published THEN 'published' WHEN scheduled_at IS NULL THEN 'unscheduled' ELSE 'scheduled' END WHERE id = p_post_id` ; refuse (`22023`) de marquer une ligne sans date ; erreur si aucune ligne visible (RLS). Le trigger de propagation ne se déclenche pas (il n'écoute que `text, media_id`).
- `update_social_post_content(p_post_id, p_text, p_media_id)` : met à jour texte et visuel d'une ligne publiée uniquement (`22023` sinon, les non publiées passent par `save_social_content_group`) ; un `media_id` inconnu devient null, comme en 1.3. Aucune propagation : le trigger ignore une source publiée.
- Groupe vide : trigger `AFTER DELETE ON social_posts` qui supprime le groupe s'il n'a plus de déclinaison ; garde `pg_trigger_depth() <= 1` pour ne pas interférer avec la cascade depuis le groupe.
- Suppression côté service : `.delete()` direct sur `social_posts` (une ligne) ou `social_content_groups` (tout), sous la RLS existante. La suppression d'une déclinaison publiée est permise : c'est un geste explicite et confirmé.
- Composeur : l'autosave continue d'envoyer `save_social_content_group` pour les non publiées ; pour chaque publiée dont le texte ou le visuel a changé, `update_social_post_content`. Marquer ou annuler vide d'abord la sauvegarde en attente, puis appelle la fonction, puis recharge le groupe. Le marquage reste possible avec des alertes (elles ne bloquent rien).
- Une ligne publiée sans date n'est pas créable par l'interface après cette story ; le cas « annuler sans date » se teste en SQL.
- Production : jouer `20261107100000_social_post_publication.sql` après les quatre migrations précédentes de l'epic.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
