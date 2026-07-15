# Plan — Continuité parcours "Opportunité gagnée → Formation" + rendez-vous commanditaire + mobile

Trois chantiers indépendants, à livrer dans cet ordre.

## 1. Rupture parcours : entrée au catalogue manquante

**Problème actuel.** Depuis une opportunité gagnée dans le CRM, on clique sur "Créer une nouvelle formation". On est envoyé vers `/formations/new?...` avec des params préremplis. Si l'intitulé demandé ne correspond à aucune entrée du catalogue (`formation_configs`), la création échoue avec un message d'erreur. L'utilisateur doit alors quitter la page, aller créer l'entrée au catalogue, puis relancer toute la démarche.

**Correctif.**
- Dans `CreateTrainingDialog` (le dialog qui suit "Opportunité gagnée"), avant de naviguer vers `/formations/new`, on vérifie via `useFormationConfigs` si l'intitulé de l'opportunité matche une entrée existante.
- Si aucun match : le dialog passe dans un 3e mode `create-catalog-entry` proposant :
  - un input pré-rempli avec l'intitulé de l'opportunité
  - les champs minimums d'une entrée catalogue (nom, durée, prix, programme URL optionnel)
  - un bouton "Créer l'entrée au catalogue et continuer"
- Après création, on rebascule automatiquement sur la navigation vers `/formations/new` avec `formation_config_id` désormais présent dans les params.
- Bonus : ajouter le même garde-fou côté `FormationEdit.tsx` (nouvelle formation) — si `formation_config_id` est passé mais introuvable, on affiche un CTA "Créer cette entrée au catalogue" au lieu d'un blocage.

## 2. Proposer un rendez-vous au commanditaire après création formation

**Problème actuel.** Une fois la formation créée, aucun raccourci pour caler un point avec le commanditaire. La fonctionnalité existe déjà dans les opportunités (`CreateCalendarEventDialog`) et dans les missions.

**Correctif.**
- Réutiliser `CreateCalendarEventDialog` (déjà branché Google Calendar via edge function `google-calendar-events`).
- Dans `FormationEdit.tsx`, ajouter un bouton "Proposer un rendez-vous au commanditaire" dans la barre d'actions de l'en-tête, actif seulement si un email commanditaire est renseigné.
- Ouvrir le dialog pré-rempli avec :
  - **Titre** : `Point préparation — {training_name} — {client_name}`
  - **Description** : template Markdown listant "Recueil des besoins · Échange sur le contenu · Adaptation · Revue planification & logistique"
  - **Invité** : email commanditaire (+ trainer optionnel)
  - **Durée** : 45 min par défaut
- L'événement est créé côté Google Agenda du user connecté ; Google envoie l'invitation au commanditaire.
- Log dans `mission_activities` ? Non — les formations ont leur propre modèle, on trace juste l'action sans nouvelle table.

## 3. Ergonomie mobile

**Problèmes signalés.**
- La barre de recherche `AppTopBar` occupe une hauteur excessive sur iPhone (padding vertical fixe `18px`, layout desktop non adapté).
- Le scroll horizontal des kanbans CRM est difficile sur mobile.

**Correctifs.**
- `AppTopBar.tsx` : passer les styles en responsive via `useIsMobile()`, réduire le padding à `10px 14px` et la hauteur du bouton search à ~34 px, cacher le raccourci ⌘K et le bouton "Nouveau" en <768px (ils restent accessibles via le menu).
- `CrmKanbanBoard` / colonnes : ajouter `overflow-x-auto` + `scroll-snap-type: x proximity` + `scroll-snap-align: start` sur chaque colonne + `-webkit-overflow-scrolling: touch`, et forcer `min-width: 85vw` sur les colonnes en mobile pour un swipe une-colonne-à-la-fois.

## Détails techniques

- Aucune nouvelle table. Le catalog entry est créé via l'API existante `useFormationConfigs.addConfig`.
- L'invite Google Calendar réutilise la connexion existante (`google_calendar_tokens`). Si non connecté, on affiche un CTA "Connecter Google Calendar" (déjà présent dans les autres flows).
- Pas de changement de RLS.
- Tests visuels manuels : iPhone 12 (390×844) et desktop 1440.

## Hors-scope

- Refonte du kanban desktop.
- Pas de synchro bidirectionnelle Google Calendar (on crée seulement).
- Pas de notification Slack sur création rendez-vous formation (peut être ajouté après si demandé).
