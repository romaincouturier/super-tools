---
title: 'Story 1.3 : joindre un visuel de la Médiathèque et être alerté d''un post incomplet'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '8f8bded56d83e6c023e91a81976b25445a7c31c7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-2-planifier-dans-le-calendrier.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Toute publication doit porter un visuel, mais le composeur ne permet pas d'en joindre. Rien ne signale non plus un texte trop long pour son réseau.

**Approach:**
- Le composeur permet de choisir le visuel d'un contenu dans la Médiathèque existante.
- Une règle d'alerte unique, écrite une fois dans `supabase/functions/_shared/` et réutilisée par le MCP en epic 4, signale « visuel manquant » et « texte trop long ».
- Les alertes s'affichent sur la carte, dans la colonne « Non planifiés » et dans le composeur.

## Boundaries & Constraints

**Always:**
- Le visuel est un `media_id` porté par chaque déclinaison (`social_posts`), avec `ON DELETE SET NULL` vers `media`. Tant que la synchro est active, il est commun à tout le groupe : le trigger de propagation recopie aussi `media_id`, et les déclinaisons publiées ne sont jamais réécrites.
- On choisit le visuel parmi les images de la Médiathèque (`useMediaLibrary`), sans aucun nouvel upload ni nouveau stockage.
- La règle d'alerte est une fonction pure : `supabase/functions/_shared/social-post-alerts.ts`, importée telle quelle par le front, comme `opportunity-value`. Elle renvoie :
  - « visuel manquant » pour tout canal ;
  - « texte trop long » avec la limite et le dépassement, quand le canal a une limite. La longueur est comptée en points de code (`[...text].length`). Un canal sans limite ne déclenche jamais cette alerte.
- Une alerte ne bloque rien : ni l'enregistrement, ni la planification, ni le glisser-déposer.
- La carte d'un groupe affiche une alerte dès qu'une de ses déclinaisons visibles en a une. Une infobulle détaille les alertes par canal.
- Les noms de fichiers affichés dans le sélecteur passent par `maskFileName` en mode démo (règle [065]).
- La RPC `save_social_content_group` accepte `media_id` dans chaque post. La migration est nouvelle et rejouable ; la propagation est testée sur PGlite (règle [058]).

**Never:**
- Pas de visuel propre à la campagne (epic 3), pas de génération d'image, pas d'upload depuis le composeur.
- Pas d'édition manuelle de `types.ts` (règle [079]).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Sans visuel | post sans `media_id` | alerte « visuel manquant » | N/A |
| Texte trop long | Instagram (2 200), texte de 2 250 caractères | alerte « texte trop long : 2 250 / 2 200 (+50) » | N/A |
| Canal sans limite | Blog, 10 000 caractères, avec visuel | aucune alerte | N/A |
| Emoji | texte de 2 200 points de code dont des emojis | aucune alerte de longueur | N/A |
| Synchro active | visuel choisi sur un groupe synchronisé | toutes les déclinaisons non publiées le reçoivent | N/A |
| Synchro coupée | visuel différent par canal | chaque déclinaison garde le sien | N/A |
| Média supprimé | le média lié est supprimé de la Médiathèque | `media_id` repasse à null, et l'alerte réapparaît | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261105120000_social_contents.sql` et `20261105130000_social_group_date.sql` -- tables, trigger `social_posts_propagate_text`, RPC `save_social_content_group`, à faire évoluer dans une nouvelle migration (`CREATE OR REPLACE`).
- `src/hooks/useMedia.ts` (`useMediaLibrary`, `MediaItem`) et `src/components/media/MediaGrid.tsx` (`MediaThumb`) -- lecture et vignettes de la Médiathèque.
- `src/components/book/BookMediaLibraryPicker.tsx` -- modèle de sélecteur : recherche, images filtrées, `maskFileName` en mode démo.
- `src/components/crm/NewOpportunityDialog.tsx:3` -- exemple d'import d'un module `_shared` depuis le front.
- `src/services/socialContents.ts`, `src/hooks/useSocialContents.ts`, `src/components/social/SocialComposerDialog.tsx`, `ContentCard.tsx`, `UndatedColumn.tsx` -- à étendre.
- `supabase/tests/social-contents.test.ts` -- harnais PGlite (les migrations sont jouées deux fois).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261106100000_social_post_media.sql` -- colonne `social_posts.media_id` ; le trigger de propagation recopie texte et visuel ; la RPC lit `media_id`. -- Socle.
- [x] `supabase/tests/social-contents.test.ts` -- propagation du visuel avec synchro active et coupée, déclinaison publiée intacte, média supprimé remis à null. -- Règle [058].
- [x] `supabase/functions/_shared/social-post-alerts.ts` et `social-post-alerts.test.ts` -- `computePostAlerts(post, channel)` et `formatAlert`, avec un test pour chaque ligne du tableau. -- Règle partagée.
- [x] `src/services/socialContents.ts` -- `media_id` dans les types, les lectures et `buildGroupPosts` ; alertes calculées pour chaque carte placée. -- Service.
- [x] `src/components/social/SocialMediaPicker.tsx` -- sélection d'une image de la Médiathèque, avec recherche et `maskFileName`. -- Sélecteur.
- [x] `src/components/social/SocialComposerDialog.tsx` -- visuel commun, ou un par onglet quand la synchro est coupée ; vignette, bouton « Retirer » ; alertes en direct par canal. -- Composeur.
- [x] `src/components/social/ContentCard.tsx`, `UndatedColumn.tsx` -- indicateur d'alerte avec infobulle par canal (UX-DR8). -- Affichage.
- [x] `src/components/social/SocialComposerDialog.test.tsx`, `SocialCalendar.test.tsx` -- choix d'un visuel envoyé dans la sauvegarde ; alerte visible sur une carte sans visuel. -- Composants.

**Acceptance Criteria:**
- Given une carte dont une déclinaison n'a pas de visuel, when le calendrier s'affiche, then l'indicateur d'alerte est visible sans ouvrir le contenu.
- Given le composeur, when on dépasse la limite d'un canal, then l'alerte du canal s'affiche en direct et Enregistrer reste possible.
- Given le mode démo, when le sélecteur s'ouvre, then les noms de fichiers sont masqués et `check-demo-mask.sh` reste à 0.

## Implementation Notes

- Migration `20261106100000_social_post_media.sql` : `media_id` nullable avec `ON DELETE SET NULL` et index ; `social_posts_propagate_text` (nom conservé, déjà inscrit en [058]) recopie texte et visuel ; le trigger écoute `text, media_id`. `save_social_content_group` est rejouée à l'identique avec `media_id` :
  - clé `media_id` absente d'un élément : le visuel existant est conservé (relu dans la sous-requête, `EXCLUDED` ne voyant que les colonnes de la table) ; à la création, null. Un ancien onglet du front resté ouvert n'efface donc plus les visuels ;
  - identifiant inconnu de `media` (supprimé entre-temps, ou invisible par la RLS `is_staff_user` de `media`) : ramené à null au lieu d'une violation de clé étrangère.
- Déclinaisons publiées hors alertes : `alertsByChannel` les ignore (carte, colonne et composeur), car elles ne peuvent plus être corrigées.
- Composeur : une fois la Médiathèque chargée (ni en attente ni en erreur), un `media_id` absent de la liste compte comme manquant pour les alertes en direct. `useMediaLibrary` accepte `{ enabled }` (rétrocompatible) ; composeur et sélecteur ne la chargent qu'ouverts.
- Suppression d'un média (`useDeleteMedia`) : invalide aussi `SOCIAL_CONTENTS_KEY`, exportée par `useSocialContents`.
- Mode démo : la recherche du sélecteur ne porte que sur les valeurs masquées (nom de fichier et source), jamais sur les vrais noms ni les tags.
- Indicateur d'alerte focalisable (`tabIndex=0`), avec le détail par canal dans son `aria-label`.
- Règle d'alerte `_shared/social-post-alerts.ts` : `computePostAlerts`, `formatAlert`, `socialTextLength` (points de code). Le formatage groupe les milliers avec une espace insécable (U+00A0), sans dépendre de la locale.
- Service : `buildGroupPosts` porte `media_id` (commun si synchro, propre sinon) ; `alertsByChannel` ; `placeGroups` prend en 4e argument facultatif les canaux (limites) et renseigne `CalendarCard.alerts` à partir des déclinaisons visibles. `UndatedColumn` réutilise `ContentCard`, qui porte l'indicateur : aucun changement propre à la colonne.
- Composeur : visuel commun en mode synchro, un par onglet sinon ; couper la synchro recopie le visuel commun sur chaque canal, la réactiver reprend celui de l'onglet affiché (la confirmation compare texte et visuel). Les alertes en direct sont calculées par la même règle sur le brouillon courant et n'empêchent pas Enregistrer.
- Sélecteur : images seulement (`file_type === "image"`), recherche nom, source, tag ; nom de fichier et texte alternatif de la vignette masqués en mode démo.
- Production : jouer `20261106100000_social_post_media.sql` explicitement, après les deux migrations précédentes.

## Spec Change Log

## Review Triage Log

- [high] Init du composeur sur un groupe existant non testée (le visuel pouvait être effacé à l'ouverture) -- patché : tests sync on/off.
- [high] Bascule de synchro avec visuel non testée -- patché : tests recopie, reprise, confirmation sur visuel seul.
- [medium] Alertes à vie sur les déclinaisons publiées sans visuel -- patché : publiées exclues (service et composeur).
- [medium] Ancien front sans clé `media_id` efface le visuel -- patché : clé absente conserve le visuel existant.
- [medium] Média supprimé pendant l'édition : violation FK, enregistrement perdu -- patché : id inconnu ramené à null, alerte en direct.
- [medium] Limite de texte non vérifiée sur la page, détail de l'infobulle non vérifié -- patché : tests.
- [medium] Sélecteur ouvert depuis un onglet non testé -- patché : test.
- [low] Recherche du sélecteur sur les vrais noms en démo ([065]) -- patché.
- [low] Médiathèque chargée composeur fermé -- patché : `enabled: open`.
- [low] Carte en retard après suppression d'un média -- patché : invalidation.
- [low] Indicateur non accessible au clavier -- patché : `tabIndex`, détail dans `aria-label`.
- [low] Propagation du visuel d'une publiée, clé absente en mise à jour -- patché : tests PGlite.
- [low] Suppression d'un média réécrit `media_id` d'une publiée -- différé (deferred-work).
- [low] Graphèmes composés comptés en points de code -- différé (epic 4), conforme à la spec.
- [low] Plafond de 1000 médias du sélecteur -- différé.
- [false] Casse de « Texte trop long » contre la matrice -- cosmétique, libellé du code retenu.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
