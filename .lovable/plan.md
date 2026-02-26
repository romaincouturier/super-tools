

# Audit Qualiopi -- Analyse et plan d'action

## Tableau synthetique des indicateurs

| Indicateur | Statut | Ce qui manque | Action prioritaire |
|---|---|---|---|
| 1 - Info publique | Couvert | Page catalogue + TrainingSummary exposent objectifs, prerequis, duree, modalites | Aucune |
| 4 - Analyse besoin | Couvert | Module "Besoins participants" avec questionnaire par token | Aucune |
| 5 - Objectifs operationnels | Couvert | Champs `objectives` sur catalogue et formations, editeur dedie | Aucune |
| 6 - Contenus adaptes | Couvert | Programme PDF, format formation, supports, lien SuperTilt | Aucune |
| 8 - Positionnement entree | Partiel | Prerequis definis mais pas de champ formel "validation des prerequis a l'entree" | Ajouter un champ "prerequis valides" par participant (recueil besoins existant couvre partiellement) |
| 10 - Adaptation au profil | Couvert | Recueil besoins + adaptations notees dans les notes de formation | Aucune |
| 11 - Evaluation atteinte objectifs | Couvert | Questionnaire evaluation avec notation par objectif | Aucune |
| 17 - Moyens humains/techniques | Partiel | Formateurs existent mais sans competences ni diplomes traces | **PRIORITE 1** |
| 19 - Ressources pedagogiques | Couvert | Documents formation, supports URL, programme PDF | Aucune |
| 21 - Competences intervenants | Manquant | Pas de competences, pas de diplomes/certifs, pas d'historique formation, pas de lien adequation | **PRIORITE 1** |
| 22 - Dev competences intervenants | Manquant | Pas d'historique des formations suivies par les formateurs | **PRIORITE 1** (inclus) |
| 26 - Referent handicap | Partiel | Pas de champ "referent handicap" ni de reseau partenaires PSH visible | Ajouter un champ referent handicap dans les parametres |
| 27 - Sous-traitants | Partiel | Pas de registre sous-traitants formel | Peut etre documente hors app (peu de sous-traitance) |
| 30 - Appreciations parties prenantes | Partiel | Beneficiaires (a chaud) + Sponsors (a froid) couverts. Manquent : equipes pedagogiques, financeurs, appreciations a froid beneficiaires | **PRIORITE 2** |
| 31 - Reclamations | Couvert | Module reclamations complet avec IA, registre, formulaire public | Aucune |
| 32 - Mesures amelioration | Partiel | Module "Ameliorations" existe mais pas de lien source (reclamation, appreciation, alea) | **PRIORITE 3** |

---

## PRIORITE 1 -- Indicateur 21 : Competences des intervenants

### Modifications base de donnees

**Nouvelles colonnes sur la table `trainers`** :
- `competences` (text[]) -- domaines de competence / intervention
- `diplomes_certifications` (text) -- texte libre ou JSON pour diplomes et certifications
- `formations_suivies` (jsonb) -- tableau d'objets `[{titre, organisme, date, duree}]`

**Nouvelle table `trainer_documents`** :
- `id` (uuid PK)
- `trainer_id` (uuid FK trainers)
- `file_name` (text)
- `file_url` (text)
- `document_type` (text) -- cv, diplome, certification, autre
- `created_at` (timestamptz)

**Nouvelle table `trainer_training_adequacy`** :
- `id` (uuid PK)
- `trainer_id` (uuid FK trainers)
- `training_id` (uuid FK trainings)
- `validated_by` (text) -- nom de la personne qui valide
- `validated_at` (date)
- `notes` (text)
- `created_at` (timestamptz)

RLS : acces authentifie pour toutes ces tables.

### Modifications UI

**`TrainerManager.tsx`** : enrichir le formulaire d'edition pour ajouter :
- Section "Competences et domaines d'intervention" (tags/chips editables)
- Section "Diplomes et certifications" (textarea)
- Section "Formations suivies" (tableau simple avec ajout/suppression : titre, organisme, date)
- Section "Documents" (upload CV, diplomes, certifications -- reutilise le pattern EntityDocumentsManager)

**`FormationDetail.tsx`** ou nouveau composant : afficher l'adequation formateur/formation avec :
- Bouton "Valider l'adequation" (nom + date)
- Affichage du statut d'adequation

---

## PRIORITE 2 -- Indicateur 30 : Appreciations multi-parties prenantes

### Etat actuel
- `training_evaluations` = appreciations beneficiaires a chaud (OK)
- `sponsor_cold_evaluations` = appreciations commanditaires/sponsors a froid (OK)
- Manquent : equipes pedagogiques, financeurs, appreciations a froid beneficiaires

### Modifications base de donnees

**Nouvelle table `stakeholder_appreciations`** :
- `id` (uuid PK)
- `training_id` (uuid FK trainings, nullable)
- `stakeholder_type` (text) -- 'pedagogique', 'financeur', 'beneficiaire_froid'
- `stakeholder_name` (text)
- `stakeholder_email` (text, nullable)
- `token` (text UNIQUE) -- pour formulaire public
- `date_envoi` (timestamptz, nullable)
- `date_reception` (timestamptz, nullable)
- `status` (text) -- 'draft', 'envoye', 'recu'
- `satisfaction_globale` (integer, nullable)
- `points_forts` (text, nullable)
- `axes_amelioration` (text, nullable)
- `commentaires` (text, nullable)
- `year` (integer) -- pour le bilan annuel financeurs
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

RLS : authentifie pour CRUD, anon pour SELECT/UPDATE par token.

### Modifications UI

**Nouvelle page `src/pages/Appreciations.tsx`** (ou section dans Evaluations) :
- Vue consolidee de toutes les appreciations par type de partie prenante
- Filtres par type, par formation, par statut
- Bouton "Envoyer un recueil" (genere un token + lien public)
- Statistiques : taux de retour par type

**Formulaire public** : `/appreciation/:token` -- formulaire simple adapte au type de partie prenante

**Dashboard FormationDetail** : section recapitulative montrant le statut des appreciations pour chaque partie prenante liee a cette formation

---

## PRIORITE 3 -- Indicateur 32 : Plan d'amelioration avec sources

### Etat actuel
La table `improvements` existe avec `training_id`, `category`, `status` mais sans lien vers la source (reclamation, appreciation, alea).

### Modifications base de donnees

**Nouvelles colonnes sur `improvements`** :
- `source_type` (text, nullable) -- 'reclamation', 'appreciation', 'evaluation', 'alea', 'audit', 'autre'
- `source_id` (uuid, nullable) -- id de la reclamation, appreciation, ou evaluation source
- `source_description` (text, nullable) -- description libre de la source quand pas de lien direct
- `priority` (text, nullable) -- 'haute', 'moyenne', 'basse'
- `deadline` (date, nullable) -- echeance prevue
- `responsible` (text, nullable) -- personne responsable

### Modifications UI

**`Ameliorations.tsx`** : enrichir pour :
- Ajouter les champs source (type + description ou lien) dans le formulaire d'ajout
- Afficher la source dans la liste (badge + lien cliquable vers la reclamation/evaluation)
- Filtrer par source
- Ajouter priorite et echeance
- Vue "Plan d'amelioration" exportable (tableau : source | action | responsable | echeance | statut)

---

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Tables `trainer_documents`, `trainer_training_adequacy`, `stakeholder_appreciations` + colonnes `trainers` + colonnes `improvements` |
| `src/components/settings/TrainerManager.tsx` | Enrichir avec competences, diplomes, formations suivies, documents |
| `src/pages/FormationDetail.tsx` | Ajouter validation adequation formateur |
| `src/pages/Appreciations.tsx` | Creation -- page consolidee appreciations |
| `src/pages/AppreciationPublic.tsx` | Creation -- formulaire public par token |
| `src/pages/Ameliorations.tsx` | Enrichir avec source, priorite, echeance |
| `src/App.tsx` | Ajout routes `/appreciation/:token` et eventuellement `/appreciations` |
| `src/pages/Dashboard.tsx` | Ajout tuile si nouveau module |
| `src/hooks/useModuleAccess.ts` | Eventuellement pas de nouveau module (integre dans evaluations) |

## Ordre d'implementation

1. Migration SQL unique avec toutes les modifications
2. Priorite 1 : TrainerManager enrichi + adequation formateur/formation
3. Priorite 2 : Table stakeholder_appreciations + page Appreciations + formulaire public
4. Priorite 3 : Colonnes improvements + enrichissement Ameliorations.tsx

