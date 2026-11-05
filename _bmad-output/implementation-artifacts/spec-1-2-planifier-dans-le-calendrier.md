---
title: 'Story 1.2 : planifier dans le calendrier avec aperçu des contenus'
type: 'feature'
created: '2026-11-05'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/specs/spec-contenus-sociaux/maquette-calendrier.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-1-rediger-un-contenu-decline.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les contenus rédigés en story 1.1 sont enregistrés, mais on ne les voit nulle part. On ne peut ni les dater d'un geste ni les rouvrir.

**Approach:** Ajouter à la page du sous-module trois éléments, conformes à `maquette-calendrier.md` :
- la colonne « Non planifiés » (reportée de la story 1.1) ;
- un calendrier mois et semaine avec l'aperçu des contenus ;
- le glisser-déposer pour dater.

Un clic sur une carte rouvre le composeur de la story 1.1.

## Boundaries & Constraints

**Always:**
- Une carte représente un contenu (le groupe), avec un badge par canal. Le statut affiché est le moins avancé de ses déclinaisons : Brouillon (sans date), puis Programmé, puis Publié.
- Les jours et les heures sont calculés en heure de Paris, avec les fonctions de `src/services/socialContents.ts`.
- La date d'un groupe se pose en base, par une RPC unique et atomique (SECURITY INVOKER, RLS appliquée), testée sur PGlite et inscrite dans `scripts/sql-tested-functions.txt` (règle [058]). Elle ne touche que les déclinaisons non publiées.
- Glisser un brouillon sans date sur un jour lui donne 09:00. Déplacer un contenu daté change le jour et garde l'heure.
- Décocher un canal dans la barre des canaux retire ses déclinaisons de la grille et de la colonne. Un contenu dont aucune déclinaison ne reste visible disparaît.
- Glisser-déposer avec `@dnd-kit/core`, comme `src/components/shared/kanban/`. Les données passent par page, puis hook, puis service. Mode démo inchangé (contrôle [065]).

**Never:**
- Pas de visuel (1.3), de thème ni de liseré coloré (1.4), de marquage publié (1.5), de notes (1.6), de vue Liste ni Aperçus. Les onglets Liste et Aperçus sont affichés désactivés.
- Pas d'édition manuelle de `types.ts` (règle [079]).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Glisser un brouillon | groupe sans date, déposé sur le 12 | toutes ses déclinaisons au 12 à 09:00 (Paris), en Programmé ; il quitte la colonne | toast `toastError`, retour à l'état précédent |
| Déplacer un contenu daté | daté le 3 à 18:00, déposé sur le 10 | le 10 à 18:00 | idem |
| Contenu partiellement publié | une déclinaison publiée, déplacé | seules les déclinaisons non publiées changent ; la carte reste au statut le moins avancé | N/A |
| Heure du soir | 23:30 à Paris | carte sur le bon jour de Paris, pas sur celui en UTC | N/A |
| Filtre de canal | Instagram décoché | les contenus uniquement Instagram disparaissent | N/A |
| Jour sans contenu | aucun contenu | case vide, pas d'erreur | N/A |

</frozen-after-approval>

## Code Map

- `src/services/socialContents.ts` -- ajouter `listGroupsInRange(fromIso, toIso)` et `listUndatedGroups()` (groupes avec leurs posts), `setGroupDate`, et les fonctions pures `groupDisplayStatus`, `parisDayKey`, `moveKeepingTime`, `buildMonthGrid` / `buildWeekGrid` (lundi en premier).
- `src/hooks/useSocialContents.ts` -- requêtes par plage et sans date, mutation de date avec mise à jour optimiste et retour arrière en cas d'erreur.
- `src/components/social/SocialComposerDialog.tsx` -- réutilisé tel quel avec `groupId`.
- `src/pages/SocialContentsPage.tsx` -- y monter les onglets, la barre des canaux, la colonne et le calendrier.
- `src/components/shared/kanban/GenericKanbanBoard.tsx`, `GenericKanbanColumn.tsx` -- modèle de `DndContext`, de capteurs et de `useDroppable`.
- `supabase/migrations/20261105120000_social_contents.sql` -- tables et RLS existantes ; la nouvelle RPC va dans une nouvelle migration.
- `supabase/tests/social-contents.test.ts` -- harnais PGlite à étendre (migration jouée deux fois, `actAs`).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261105130000_social_group_date.sql` -- RPC `set_social_group_date(p_group_id uuid, p_scheduled_at timestamptz)` : pose la date sur les déclinaisons non publiées, statut `scheduled` (ou `unscheduled` si null), en une seule instruction ; accordée à `authenticated` seulement. -- Date atomique (R-03).
- [ ] `supabase/tests/social-contents.test.ts`, `scripts/sql-tested-functions.txt` -- tests de la RPC : groupe entier daté, déclinaison publiée intacte, date null, refus sans droit. -- Règle [058].
- [ ] `src/services/socialContents.ts` et `src/services/socialContents.test.ts` -- lectures, `setGroupDate`, fonctions pures et tests (statut le moins avancé, jour de Paris en soirée et aux changements d'heure, garde de l'heure, grilles du lundi au dimanche, mois à cheval sur deux semaines). -- Logique testable.
- [ ] `src/hooks/useSocialContents.ts` -- requêtes et mutation optimiste. -- Couche hook.
- [ ] `src/components/social/UndatedColumn.tsx` -- « Non planifiés · N », cartes glissables, clic qui rouvre le composeur. -- UX-DR3.
- [ ] `src/components/social/ContentCard.tsx` -- pastille de statut, heure, badges des canaux (nom en infobulle), début du texte tronqué. -- UX-DR5 sans liseré.
- [ ] `src/components/social/SocialCalendar.tsx` -- vues mois et semaine, navigation précédent et suivant, jour courant en évidence, jours hors mois grisés, cases déposables, légende à trois statuts. -- UX-DR4, UX-DR7.
- [ ] `src/components/social/ChannelFilterBar.tsx` et `src/pages/SocialContentsPage.tsx` -- barre des canaux, onglets Calendrier (actif), Liste et Aperçus (désactivés), composition de la page. -- UX-DR1, FR3.
- [ ] `src/components/social/SocialCalendar.test.tsx` -- rendu d'une carte sur le bon jour, filtre de canal, clic qui ouvre le composeur, dépôt qui appelle la mutation avec la bonne date. -- Composant.

**Acceptance Criteria:**
- Given des contenus datés et non datés, when la page s'ouvre, then les datés sont sur leur jour et les non datés dans « Non planifiés · N », avec N juste.
- Given une carte, when on clique dessus, then le composeur s'ouvre sur ce contenu, et l'enregistrer met la carte à jour.
- Given le mode démo, when l'écran s'affiche, then `scripts/check-demo-mask.sh` reste à 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
