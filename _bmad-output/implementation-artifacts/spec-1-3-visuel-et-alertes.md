---
title: 'Story 1.3 : joindre un visuel de la Médiathèque et être alerté d''un post incomplet'
type: 'feature'
created: '2026-11-06'
status: 'draft'
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
- [ ] `supabase/migrations/20261106100000_social_post_media.sql` -- colonne `social_posts.media_id` ; le trigger de propagation recopie texte et visuel ; la RPC lit `media_id`. -- Socle.
- [ ] `supabase/tests/social-contents.test.ts` -- propagation du visuel avec synchro active et coupée, déclinaison publiée intacte, média supprimé remis à null. -- Règle [058].
- [ ] `supabase/functions/_shared/social-post-alerts.ts` et `social-post-alerts.test.ts` -- `computePostAlerts(post, channel)` et `formatAlert`, avec un test pour chaque ligne du tableau. -- Règle partagée.
- [ ] `src/services/socialContents.ts` -- `media_id` dans les types, les lectures et `buildGroupPosts` ; alertes calculées pour chaque carte placée. -- Service.
- [ ] `src/components/social/SocialMediaPicker.tsx` -- sélection d'une image de la Médiathèque, avec recherche et `maskFileName`. -- Sélecteur.
- [ ] `src/components/social/SocialComposerDialog.tsx` -- visuel commun, ou un par onglet quand la synchro est coupée ; vignette, bouton « Retirer » ; alertes en direct par canal. -- Composeur.
- [ ] `src/components/social/ContentCard.tsx`, `UndatedColumn.tsx` -- indicateur d'alerte avec infobulle par canal (UX-DR8). -- Affichage.
- [ ] `src/components/social/SocialComposerDialog.test.tsx`, `SocialCalendar.test.tsx` -- choix d'un visuel envoyé dans la sauvegarde ; alerte visible sur une carte sans visuel. -- Composants.

**Acceptance Criteria:**
- Given une carte dont une déclinaison n'a pas de visuel, when le calendrier s'affiche, then l'indicateur d'alerte est visible sans ouvrir le contenu.
- Given le composeur, when on dépasse la limite d'un canal, then l'alerte du canal s'affiche en direct et Enregistrer reste possible.
- Given le mode démo, when le sélecteur s'ouvre, then les noms de fichiers sont masqués et `check-demo-mask.sh` reste à 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
