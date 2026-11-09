---
title: 'Story 1.6 : poser des notes dans le calendrier'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: '83baa6421fc6b18d1781ab72a4e7fd502b31185a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-themes-et-filtres.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Rien ne permet de garder un repère dans le calendrier (lancement, relance, idée) à côté des publications.

**Approach:**
- Une note est un jour, un texte et une couleur. Elle s'ajoute depuis un jour du calendrier, s'affiche sur ce jour, distincte des cartes de contenu.
- Elle se modifie, se déplace sur un autre jour (glisser-déposer ou champ date) et se supprime.
- Elle reste en dehors des statuts, des filtres et des compteurs.

## Boundaries & Constraints

**Always:**
- Table `social_calendar_notes` : `day date` (jour sans heure, aucun fuseau), `text` non vide après retrait des blancs (500 caractères au plus), `color` `#rrggbb` parmi la palette des thèmes, `created_by`, horodatages. RLS active, policies sur `is_admin` ou `has_module_access(auth.uid(), 'supertilt_fr')`, `WITH CHECK` compris ; tout utilisateur du module gère les notes. Table ajoutée aux sauvegardes (règle [038]). Migration rejouable (règle [042]).
- Une note s'affiche sur son jour, en vue mois et semaine, au-dessus des cartes de contenu, avec un style distinct (fond teinté de sa couleur, icône de note, pas de pastille de statut, pas de badge canal).
- Les notes ne passent par aucun filtre (thème, réseau, statut) : elles restent visibles quels que soient les filtres. Elles n'entrent ni dans `groupDisplayStatus`, ni dans le compteur « Non planifiés », ni dans aucun comptage de posts (1.6-UNIT-001).
- Ajout : un bouton « Ajouter une note » sur chaque jour ouvre un petit formulaire (texte, couleur). Clic sur une note : même formulaire en édition, avec le jour modifiable et « Supprimer » confirmé par `useConfirm()` (règle [021]).
- Déplacement : glisser une note sur un autre jour change son jour ; le jour reste une date, jamais un instant.
- Flux page -> hook -> service (règle [014b]) ; palette partagée avec les thèmes, sans copie.

**Never:**
- Pas de note sans jour, pas de note sur plusieurs jours, pas de lien entre une note et un contenu, pas de rappel ni de notification.
- Pas d'édition manuelle de `types.ts` (règle [079]).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Ajouter | 12 nov., « Lancement AI4Product », orange | note sur le 12, distincte des cartes | N/A |
| Texte vide | texte « » ou espaces | Enregistrer désactivé ; refus en base | N/A |
| Jour sans heure | note du 30 mars (changement d'heure), lue en `TZ=UTC` | affichée le 30 mars | N/A |
| Déplacer | glisser du 12 au 14 | note sur le 14, plus sur le 12 | N/A |
| Modifier | texte et couleur changés | calendrier à jour | N/A |
| Supprimer | Supprimer puis confirmer | note disparue ; annuler la garde | N/A |
| Filtres actifs | pastille Programmé et thème A | notes toujours visibles | N/A |
| Compteurs | 2 notes, 1 brouillon sans date | « Non planifiés · 1 » | N/A |
| Hors plage | note du mois suivant | absente de la vue courante | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261106110000_social_themes.sql` -- modèle de table avec contrainte de blancs Unicode, RLS par opération, trigger `update_updated_at_column`.
- `supabase/tests/social-contents.test.ts` -- harnais PGlite (`actAs`, EMMA hors Romain, OTHER sans droit, admin, anon).
- `supabase/functions/scheduled-backup/index.ts` et `supabase/functions/backup-export/index.ts` -- `TABLES_TO_BACKUP`.
- `src/components/social/SocialSettingsDialog.tsx:21` -- `THEME_COLORS`, à déplacer dans le service (ou un module partagé) pour servir aux thèmes et aux notes.
- `src/services/socialContents.ts` -- `parisDayKey`, `addDays`, `applySocialFilters`, types ; `src/hooks/useSocialContents.ts` -- `SOCIAL_CONTENTS_KEY`, modèle des hooks.
- `src/components/social/SocialCalendar.tsx` -- `DAY_DROP_PREFIX`, cellule de jour droppable ; `ContentCard.tsx` -- modèle `useDraggable` (data `{ card }`).
- `src/pages/SocialContentsPage.tsx` -- `handleDragEnd` (dépôt d'une carte), plage `firstDay`/`lastDay` en clés de jour.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261109100000_social_calendar_notes.sql` -- table, contraintes, index sur `day`, RLS. -- Socle.
- [x] `supabase/tests/social-contents.test.ts` -- jour sans heure (1.6-SQL-001), texte vide ou blanc refusé, couleur invalide refusée, RLS par opération (sans droit, hors Romain, admin, anon), rejeu. -- Règle [058] et R-01.
- [x] Sauvegardes -- `social_calendar_notes` dans les deux listes. -- Règle [038].
- [x] `src/services/socialContents.ts` -- `SocialCalendarNote`, `listNotesInRange(fromDay, toDay)`, `createNote`, `updateNote`, `deleteNote` (erreur si 0 ligne), `notesByDay` (fonction pure) ; palette partagée. -- Service.
- [x] `src/hooks/useSocialContents.ts` -- hooks de lecture et d'écriture des notes, invalidation en `onSettled`. -- Hooks.
- [x] `src/components/social/CalendarNote.tsx` et `CalendarNoteForm.tsx` -- note glissable et formulaire (texte, couleur, jour en édition, Supprimer confirmé). -- 1.6-COMP-001, 002.
- [x] `SocialCalendar.tsx` et `SocialContentsPage.tsx` -- notes par jour, bouton d'ajout, dépôt d'une note sur un jour. -- Câblage.
- [x] Tests : notes hors filtres et compteurs (1.6-UNIT-001), ajout, édition, déplacement, suppression confirmée et annulée (1.6-COMP-001, 002). -- Couverture.

**Acceptance Criteria:**
- Given un jour du calendrier, when l'utilisateur ajoute une note avec un texte et une couleur, then elle s'affiche sur ce jour, distincte des cartes de contenu, hors de tout statut, filtre et compteur.
- Given une note, when l'utilisateur la modifie, la glisse sur un autre jour ou la supprime après confirmation, then le calendrier se met à jour.

## Implementation Notes

- Le jour se lit et s'écrit comme une chaîne `YYYY-MM-DD` (pas de `new Date(day)` côté front) : c'est la clé de jour déjà utilisée par la grille.
- Glisser-déposer : `useDraggable({ id: "note:<id>", data: { note } })` ; `handleDragEnd` distingue `data.note` de `data.card` ; même cible `DAY_DROP_PREFIX`. Un dépôt sur le même jour ne fait rien.
- Le bouton d'ajout de chaque jour est discret (visible au survol et au focus clavier) et ne doit pas déclencher le dépôt ni ouvrir une carte.
- Mode démo : le texte d'une note peut citer un client ; passer par `maskText` en mode démo et garder `check-demo-mask.sh` à 0. Le texte des cartes de contenu n'est pas masqué aujourd'hui : écart noté dans `deferred-work.md`, à traiter par `/anonymisation-demo` avant la PR.
- Auteur : `created_by` est posé à `auth.uid()` par le trigger `social_calendar_notes_created_by` (fonction `social_calendar_notes_set_created_by`, listée dans `scripts/sql-tested-functions.txt`) et figé à la modification ; ni l'insertion ni l'update ne peuvent l'attribuer à un autre compte.
- Palette : `THEME_COLORS` vit dans `src/services/socialContents.ts`, importée par les réglages des thèmes et par le formulaire de note ; la contrainte `social_calendar_notes_color_palette` en recopie les neuf valeurs (à modifier ensemble).
- Longueur : 500 points de code (`noteTextLength`, `[...text].length`), comme `char_length` en base ; pas de `maxLength` UTF-16. Le formulaire affiche un compteur et désactive Enregistrer au-delà ; le service refuse aussi.
- Formulaire : le corps est monté avec une `key` par cible (`note:<id>` ou `day:<jour>`) et initialise son état depuis la cible. Pendant l'envoi, Annuler, Supprimer et la fermeture du dialogue sont désactivés. Jour vide ou invalide : Enregistrer désactivé. Erreur d'enregistrement ou de suppression : toast, formulaire ouvert.
- Mode démo : `CalendarNote` affiche le texte et l'aria-label masqués (`maskText`, découpé en points de code pour ne jamais couper un emoji). Le formulaire d'une note existante montre le texte masqué en lecture seule et n'enregistre rien ; suppression et glisser-déposer restent possibles.
- Lecture des notes : son erreur n'entre pas dans le chargement ni l'erreur du calendrier ; notes vides et bandeau « Notes indisponibles » avec Réessayer.
- Déplacement : `useUpdateSocialNote` (clé de mutation dédiée) met à jour le cache de façon optimiste ; en erreur, seule la note concernée revient à ses valeurs précédentes, sur les champs qu'aucune modification plus récente n'a réécrits ; la relecture n'a lieu qu'une fois la dernière modification en vol terminée (`isMutating`).
- Une note enregistrée par le champ Jour hors de la grille affichée donne un toast « Note déplacée au JJ/MM ».
- Le bouton d'ajout est toujours visible sur écran tactile (`[@media(hover:none)]:opacity-100`).
- Production : jouer `20261109100000_social_calendar_notes.sql` après les cinq migrations précédentes de l'epic.

## Spec Change Log

## Review Triage Log

- [high] Masquage démo de `CalendarNote` non testé (le ratchet [065] ne voit pas `.text`) -- patché : test dédié.
- [medium] Texte réel affiché dans le formulaire d'édition en démo -- patché : texte masqué en lecture seule, enregistrement désactivé.
- [medium] Une erreur de lecture des notes masquait tout le calendrier (migration non jouée par exemple) -- patché : bandeau « Notes indisponibles » isolé.
- [medium] Retour arrière optimiste écrasant un déplacement concurrent -- patché : restauration par note, relecture quand plus rien n'est en vol.
- [medium] Clé de requête des notes non vérifiée -- patché : test de hook sans clé en dur.
- [low] Emojis coupés par `maskWord` -- patché : découpe en points de code.
- [low] Longueur comptée en UTF-16 côté front -- patché : points de code, compteur, refus au-delà de 500.
- [low] Formulaire : flash de l'état précédent, fermeture pendant l'envoi, jour vide -- patché : formulaire monté par cible, fermeture bloquée, jour validé.
- [low] Note déplacée hors de la vue sans retour -- patché : toast.
- [low] Bouton d'ajout invisible au toucher -- patché.
- [low] `created_by` falsifiable sur les notes -- patché : trigger ; même écart sur `social_themes` différé.
- [low] Tests sans valeur de preuve (1.6-UNIT-001 de service, « sans statut ni canal », jour sans heure côté front) -- remplacés.
- [low] `updateNote` (trim, minuscules), erreurs Supabase non relayées, erreurs de création et suppression -- patché : tests.

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
