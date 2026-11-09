---
title: 'Story 1.2 : planifier dans le calendrier avec aperçu des contenus'
type: 'feature'
created: '2026-11-05'
status: 'done'
baseline_commit: '63cb343f48d5957085c0b3c9b77c26244cb02a9a'
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
- [x] `supabase/migrations/20261105130000_social_group_date.sql` -- RPC `set_social_group_date(p_group_id uuid, p_scheduled_at timestamptz)` : pose la date sur les déclinaisons non publiées, statut `scheduled` (ou `unscheduled` si null), en une seule instruction ; accordée à `authenticated` seulement. -- Date atomique (R-03).
- [x] `supabase/tests/social-contents.test.ts`, `scripts/sql-tested-functions.txt` -- tests de la RPC : groupe entier daté, déclinaison publiée intacte, date null, refus sans droit. -- Règle [058].
- [x] `src/services/socialContents.ts` et `src/services/socialContents.test.ts` -- lectures, `setGroupDate`, fonctions pures et tests (statut le moins avancé, jour de Paris en soirée et aux changements d'heure, garde de l'heure, grilles du lundi au dimanche, mois à cheval sur deux semaines). -- Logique testable.
- [x] `src/hooks/useSocialContents.ts` -- requêtes et mutation optimiste. -- Couche hook.
- [x] `src/components/social/UndatedColumn.tsx` -- « Non planifiés · N », cartes glissables, clic qui rouvre le composeur. -- UX-DR3.
- [x] `src/components/social/ContentCard.tsx` -- pastille de statut, heure, badges des canaux (nom en infobulle), début du texte tronqué. -- UX-DR5 sans liseré.
- [x] `src/components/social/SocialCalendar.tsx` -- vues mois et semaine, navigation précédent et suivant, jour courant en évidence, jours hors mois grisés, cases déposables, légende à trois statuts. -- UX-DR4, UX-DR7.
- [x] `src/components/social/ChannelFilterBar.tsx` et `src/pages/SocialContentsPage.tsx` -- barre des canaux, onglets Calendrier (actif), Liste et Aperçus (désactivés), composition de la page. -- UX-DR1, FR3.
- [x] `src/components/social/SocialCalendar.test.tsx` -- rendu d'une carte sur le bon jour, filtre de canal, clic qui ouvre le composeur, dépôt qui appelle la mutation avec la bonne date. -- Composant.

**Acceptance Criteria:**
- Given des contenus datés et non datés, when la page s'ouvre, then les datés sont sur leur jour et les non datés dans « Non planifiés · N », avec N juste.
- Given une carte, when on clique dessus, then le composeur s'ouvre sur ce contenu, et l'enregistrer met la carte à jour.
- Given le mode démo, when l'écran s'affiche, then `scripts/check-demo-mask.sh` reste à 0.

## Implementation Notes

- RPC `set_social_group_date` : un groupe invisible pour l'appelant (RLS) lève « Contenu introuvable » au lieu de ne rien faire en silence ; elle renvoie le nombre de déclinaisons modifiées. `anon` n'a pas le droit d'exécution.
- Lectures en deux temps (ids des groupes par `social_posts`, puis groupes avec tous leurs posts), pour que la carte voie aussi les déclinaisons hors de la plage ou publiées. La page fusionne les deux listes et `placeGroups` les répartit (dédoublonnage, filtre de canal, statut le moins avancé, jour de Paris, tri horaire).
- Date d'une carte : dès qu'une déclinaison visible est datée (quel que soit son statut), la carte va sur le jour de la plus tôt d'entre elles dans la plage chargée, à défaut la plus tôt ; elle ne va dans « Non planifiés » que si aucune déclinaison visible n'a de date. Le statut affiché reste le moins avancé. Une carte Publié n'est pas glissable.
- Mutation optimiste sur les seules clés `range` et `undated`, retour au cliché en cas d'erreur, toast par `toastError` dans la page, invalidation à la fin.
- Glisser-déposer : capteurs de `useKanbanDnd` (souris à 8 px, ce qui laisse passer le clic). Capteur clavier non activé : ses touches d'activation (Entrée, Espace) sont celles qui ouvrent la carte, et `sortableKeyboardCoordinates` ne déplace pas un élément hors `SortableContext`. La colonne « Non planifiés » n'est pas une zone de dépôt (retirer la date n'est pas demandé).
- Tests ajoutés hors liste : `src/hooks/useSocialContents.test.tsx` (mise à jour optimiste et retour arrière, ligne « Erreur » du tableau). Le test de dépôt appelle le `onDragEnd` capturé du `DndContext` ; la mécanique réelle du glisser reste à couvrir par l'E2E Playwright prévu à l'epic.
- Production : jouer `20261105130000_social_group_date.sql` explicitement, après celle de la story 1.1.

## Spec Change Log

## Review Triage Log

Passe 1 (5 nov.), trois couches : chasseur à l'aveugle, chasseur de cas limites, trous de vérification.

| # | Constat | Verdict | Preuve et décision |
|---|---|---|---|
| 1 | Un contenu partiellement publié quitte le calendrier pour « Non planifiés » | medium | `placeGroups` place la carte d'après les déclinaisons au statut le moins avancé, ici sans date. Le cas du tableau attend que la carte reste au calendrier. Corrigé (patch). |
| 2 | Un groupe chargé pour la plage se place hors de la grille | medium | Même cause : la date retenue peut tomber hors de la plage. Corrigé avec le n° 1 (patch). |
| 3 | Cartes d'un jour triées sur des chaînes ISO aux formats mélangés | low | `localeCompare` sur « Z » et « +00:00 ». Tri par `Date.parse` (patch). |
| 4 | Déposer une carte sur son propre jour écrit quand même | low | La comparaison de chaînes échoue entre le format du helper et celui de la base. `Date.parse`, avec un test (patch). |
| 5 | Une erreur de chargement affiche un calendrier vide | medium | La page ne lit que `isLoading`. Message d'erreur et bouton « Réessayer » (patch). |
| 6 | Une carte Publié reste glissable sans effet | low | La RPC ne touche pas les déclinaisons publiées. Glisser désactivé (patch). |
| 7 | Clavier : Espace ignoré, gestionnaire dnd-kit écrasé | medium | `onKeyDown` est placé après `{...listeners}`. Corrigé : Entrée et Espace ouvrent la carte, et le gestionnaire dnd-kit est appelé. Le capteur clavier reste désactivé : ses touches sont les mêmes que celles qui ouvrent la carte. La date se change au clavier dans le composeur (patch). |
| 8 | La pastille de statut n'est pas annoncée par les lecteurs d'écran | low | `aria-label` sans rôle. `role="img"` (patch). |
| 9 | La plage (début, fin) chargée par le calendrier n'est pas testée | medium | Trou de vérification déjà vérifié par la couche. Test ajouté (patch). |
| 10 | La mise à jour optimiste de RANGE_KEY n'est pas testée | medium | Trou de vérification déjà vérifié par la couche. Test ajouté (patch). |
| 11 | `listGroupsInRange` et `listUndatedGroups` n'ont pas de test | medium | Trou de vérification. Il faut un mock du client Supabase que le fichier n'a pas ; le risque principal est couvert par le n° 9. Reporté (defer). |
| 12 | Requêtes sans limite, et `.in(ids)` qui grossit avec les brouillons | maybe-false | Volumes actuels minimes ; ce n'est vrai qu'au-delà de 1 000 lignes ou d'une URL trop longue. Reporté (defer). |
| 13 | Glisser fusionne des dates différentes par canal | false | Rien ne crée de dates différentes dans un groupe : la date est commune au groupe (décision du test design). |
| 14 | On ne peut pas retirer une date depuis le calendrier | false | Non demandé par l'intention, et possible dans le composeur (« Retirer la date »). |
| 15 | On peut programmer dans le passé | false | Il n'y a pas de publication automatique : le marquage publié est manuel. |
| 16 | Onglets Liste et Aperçus désactivés | false | Exigés par l'intention (« affichés désactivés »). |
| 17 | Pas de note de déploiement ni d'impact sécurité | false | Ces notes vont dans la PR de l'epic, pas dans le code. |
| 18 | Glisser avec un filtre de canal actif déplace aussi les canaux masqués | false | Conforme à l'intention : la date est posée sur tout le groupe. |
| 19 | Groupe dont tous les canaux sont désactivés | low | Aucun écran ne désactive de canal (réservé aux admins). Rejeté. |
| 20 | Une heure inexistante au changement d'heure est décalée | low | 02:xx un seul jour par an. Rejeté. |
| 21 | Deux glissements concurrents dont le premier échoue | low | L'invalidation de `onSettled` rétablit l'état. Rejeté. |
| 22 | La RPC renvoie 0 ligne modifiée et la carte revient en place | low | Le seul cas réel (tout publié) est bloqué par le n° 6. Rejeté. |
| 23 | Le jour courant n'est pas recalculé passé minuit | low | Rare, sans effet sur les données. Rejeté. |
| 24 | Le badge d'abréviation n'est pas focalisable | low | Le nom complet du canal est aussi écrit dans le composeur. Rejeté. |

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
