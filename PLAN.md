# Plan Qualiopi post-audit — 7 features

## Vue d'ensemble

Toutes les tables Supabase existent déjà (`improvements`, `reclamations`, `trainers`,
`trainer_training_adequacy`, `training_participants`). Le travail est principalement front-end
avec quelques ajouts de colonnes côté base.

Ordre d'implémentation : features groupées par page/composant pour minimiser les allers-retours.

---

## Feature 1 : Parcours apprenant (vue cross-formations)

**Besoin** : Ressortir toutes les actions qui concernent un apprenant donné, toutes formations confondues.

**Fichiers existants** :
- `src/pages/BesoinsParticipants.tsx` — vue par formation uniquement
- `src/components/formations/ParticipantList.tsx` — liste par training_id

**Plan** :
1. Créer `src/components/participants/ParticipantSearchDrawer.tsx`
   - Input recherche par email ou nom
   - Query `training_participants` filtré par email, join :
     - `trainings(training_name, start_date, end_date)`
     - `training_evaluations(appreciation_generale, date_soumission, certificate_url)`
     - `questionnaire_besoins(etat, date_soumission)`
   - Afficher une timeline/liste : formations suivies, enquêtes besoins, évaluations, certificats, conventions signées
2. Ajouter un bouton "Rechercher un apprenant" dans `BesoinsParticipants.tsx` qui ouvre ce drawer
3. Réutiliser les composants Badge/Card/Sheet existants

**Refactoring** : Extraire les queries Supabase participants dans un hook `useParticipantHistory(email)`.

---

## Feature 2 : Mapping compétences formateur ↔ formation

**Besoin** : Rendre plus claire l'adéquation entre les compétences du formateur et le sujet de la formation.

**Fichiers existants** :
- `src/components/formations/TrainerAdequacy.tsx` (165 lignes) — affiche juste "Validée/Non validée"
- `src/components/settings/TrainerManager.tsx` — gère `trainers.competences[]`
- Table `trainer_training_adequacy` — colonnes : trainer_id, training_id, validated_by, validated_at, notes

**Plan** :
1. Enrichir `TrainerAdequacy.tsx` :
   - Charger les compétences du formateur (`trainers.competences[]`)
   - Charger le sujet/objectifs de la formation (`trainings.training_name, trainings.objectives`)
   - Afficher un tableau visuel côte-à-côte : compétences formateur | objectifs formation
   - Ajouter un champ `notes` (justification de l'adéquation) lors de la validation
   - Sauvegarder les notes dans `trainer_training_adequacy.notes`
2. Fix le bug actuel : la requête `trainers.select("id").limit(10)` est trop approximative
   - Utiliser le `trainer_id` stocké dans `trainings` au lieu de chercher par nom
3. Ajouter la mention "Indicateurs 21 & 22" dans le header du composant

**Refactoring** : Corriger la requête trainer (actuellement fragile, prend le 1er trainer trouvé).

---

## Feature 3 : Indicateur 30 — Terminologie précise (Aléas, Réclamation, Attendu)

**Besoin** : Le formulaire de réclamation doit distinguer clairement les types Qualiopi : aléa vs réclamation vs difficulté, et capturer l'attendu initial.

**Fichiers existants** :
- `src/pages/ReclamationPublic.tsx` (307 lignes) — formulaire public
- `src/pages/Reclamations.tsx` (564 lignes) — admin
- Table `reclamations` — colonnes actuelles : problem_type, description, severity

**Plan** :
1. Ajouter à la table `reclamations` (migration Supabase) :
   - `nature` : enum `'reclamation' | 'alea' | 'difficulte'` (défaut: 'reclamation')
   - `attendu_initial` : text (ce qui était attendu)
   - `resultat_constate` : text (ce qui s'est réellement passé)
2. Mettre à jour `ReclamationPublic.tsx` :
   - Ajouter le champ "Nature" en haut du formulaire (3 RadioGroupItem avec descriptions Qualiopi) :
     - Réclamation : "Expression formelle d'insatisfaction"
     - Aléa : "Événement imprévu survenu pendant la formation"
     - Difficulté rencontrée : "Obstacle ou problème identifié"
   - Ajouter les champs "Attendu initial" et "Résultat constaté"
   - Renommer "Description du problème" → "Description détaillée"
3. Mettre à jour `Reclamations.tsx` admin :
   - Afficher la nature dans la liste et le drawer
   - Ajouter filtre par nature
   - Ajouter les nouveaux champs dans le drawer de détail
   - Mettre à jour le formulaire de création manuelle

**Refactoring** : Extraire les constantes PROBLEM_TYPES, SEVERITIES, CANALS dans un fichier partagé
`src/lib/reclamationConstants.ts` (utilisé par ReclamationPublic + Reclamations).

---

## Feature 4 : Indicateur 31 — Notes d'amélioration + suivi mensuel + historique

**Besoin** : Ajouter des notes de suivi par amélioration, relance mensuelle par mail, historique des actions.

**Fichiers existants** :
- `src/pages/Ameliorations.tsx` (712 lignes) — page monolithique
- Table `improvements` — pas de champ notes/historique

**Plan** :
1. Créer une table `improvement_notes` en Supabase :
   - `id`, `improvement_id` (FK), `content` (text), `created_at`, `created_by`
   - Chaque note = une entrée dans l'historique
2. Créer `src/components/ameliorations/ImprovementDetailDrawer.tsx` :
   - Sheet/Drawer avec les détails complets de l'amélioration
   - Section "Historique / Notes de suivi" : liste chronologique des notes
   - Formulaire d'ajout de note (Textarea + bouton)
   - Les changements de statut sont aussi loggés automatiquement comme notes
3. Mettre à jour `Ameliorations.tsx` :
   - Clic sur une amélioration → ouvre le drawer de détail
   - Ajouter un badge "dernière mise à jour" sur chaque carte
4. Suivi mensuel :
   - Ajouter colonnes `last_reminder_sent_at` et `next_reminder_date` à `improvements`
   - Créer un bouton "Envoyer les relances" dans la page admin qui envoie un email
     récapitulatif des améliorations en cours au responsable
   - Ou : créer une edge function Supabase `improvement-monthly-reminder` déclenchée par cron

**Refactoring** : Extraire de `Ameliorations.tsx` :
- `src/components/ameliorations/ImprovementCard.tsx` — carte individuelle
- `src/components/ameliorations/ImprovementFilters.tsx` — barre de filtres
- `src/components/ameliorations/AddImprovementDialog.tsx` — dialog de création

---

## Feature 5 : Modifier une amélioration

**Besoin** : Pouvoir éditer titre, description, priorité, échéance, responsable après création.

**Fichiers existants** :
- `src/pages/Ameliorations.tsx` — Dialog création uniquement, pas d'édition

**Plan** :
1. Transformer `AddImprovementDialog` (extrait en Feature 4) en `ImprovementFormDialog`
   - Accepte un prop `improvement?: Improvement` pour le mode édition
   - Pré-remplit les champs si édition
   - Appelle `update` au lieu de `insert` si id présent
2. Ajouter "Modifier" dans le DropdownMenu de chaque carte
3. Ajouter un bouton "Modifier" dans le `ImprovementDetailDrawer`

**Refactoring** : Mutualisé avec Feature 4 (même composant dialog).

---

## Feature 6 : Vue Kanban pour améliorations

**Besoin** : Présenter les améliorations sous forme de tableau Kanban (colonnes par statut).

**Fichiers existants** :
- `src/pages/Ameliorations.tsx` — groupedImprovements déjà prêt (pending/in_progress/completed/cancelled)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — déjà installés dans le projet
- Le CRM (`src/pages/Crm.tsx`) et Missions (`src/pages/Missions.tsx`) utilisent déjà un Kanban DnD

**Plan** :
1. Créer `src/components/ameliorations/ImprovementKanban.tsx` :
   - 4 colonnes : En attente | En cours | Terminées | Annulées
   - Chaque colonne affiche le count + les cartes `ImprovementCard`
   - Drag & drop entre colonnes → `handleStatusChange`
   - S'inspirer du pattern DnD du CRM (DndContext + SortableContext)
2. Mettre à jour `Ameliorations.tsx` :
   - Toggle vue Liste / Kanban (bouton en haut)
   - Stocker la préférence dans localStorage
3. Les cartes Kanban affichent : titre, badge catégorie, badge priorité, responsable, échéance

**Refactoring** : Réutiliser les composants DnD existants du projet. Extraire un hook
`useImprovements()` pour la logique fetch/filter/status-change partagée entre liste et Kanban.

---

## Feature 7 : Supprimer une amélioration en brouillon

**Besoin** : Permettre la suppression uniquement des améliorations en brouillon/pending.

**Fichiers existants** :
- `Ameliorations.tsx` → `handleDelete` supprime sans restriction de statut

**Plan** :
1. Ajouter le statut `"draft"` dans l'enum des statuts d'amélioration (BDD + front)
2. Quand on crée une amélioration sans remplir tous les champs obligatoires → statut "draft"
3. Conditionner la suppression hard-delete :
   - `draft` ou `pending` → suppression autorisée avec confirmation
   - `in_progress` / `completed` → pas de suppression, uniquement "Annuler" (cancelled)
4. Ajouter la colonne Kanban "Brouillons" (avant "En attente")
5. Mettre à jour `statusConfig` avec le label "Brouillon" et son style

---

## Ordre d'implémentation recommandé

| Étape | Features | Justification |
|-------|----------|---------------|
| 1 | 4 + 5 + 6 + 7 | Bloc Améliorations — refactoring commun, dépendances croisées |
| 2 | 3 | Bloc Réclamations — indépendant |
| 3 | 2 | Adéquation formateur — indépendant, petit scope |
| 4 | 1 | Parcours apprenant — nouvelle page, plus exploratoire |

Estimation : ~4 étapes de travail, chacune avec commit + push.
