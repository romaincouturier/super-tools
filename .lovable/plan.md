

# Module Reclamations -- Indicateur 31 Qualiopi

## Vue d'ensemble

Deux volets :
1. **Formulaire public** (`/reclamation/:token`) : un client peut deposer une reclamation sans authentification, via un lien unique (meme pattern que `/questionnaire/:token` ou `/evaluation/:token`).
2. **Page interne** (`/reclamations`) : le formateur gere, traite et cloture les reclamations avec assistance IA.

---

## 1. Base de donnees (migration SQL)

### Table `reclamations`

| Colonne | Type | Notes |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| token | text UNIQUE NOT NULL | lien public d'acces |
| date_reclamation | date | date de la reclamation |
| client_name | text | nom client / structure |
| client_email | text | email du reclamant |
| canal | text | mail, telephone, formulaire, autre |
| problem_type | text | contenu, organisation, logistique, technique, facturation, relationnel, autre |
| description | text | description du probleme |
| severity | text | mineure, significative, majeure |
| status | text DEFAULT 'open' | open, in_progress, closed |
| actions_decided | text | actions decidees par le formateur |
| response_sent | text | message de reponse envoye |
| response_date | date | date de reponse |
| ai_analysis | text | analyse IA |
| ai_response_draft | text | brouillon reponse IA |
| qualiopi_summary | text | resume 3-5 lignes Qualiopi |
| training_id | uuid FK trainings | lien optionnel formation |
| mission_id | uuid FK missions | lien optionnel mission |
| created_by | uuid | null si soumis par le public |
| created_at | timestamptz DEFAULT now() | |
| updated_at | timestamptz DEFAULT now() | |

### RLS

- SELECT/INSERT/UPDATE/DELETE pour les utilisateurs authentifies (meme pattern que `improvements`)
- SELECT + INSERT public (anon) filtre par token : permet au formulaire public de lire sa propre reclamation et d'en creer une nouvelle

### Enum

- Ajout de `'reclamations'` a l'enum `app_module`

### Trigger

- `updated_at` auto-update via `update_updated_at_column()`

---

## 2. Module access (`src/hooks/useModuleAccess.ts`)

- Ajout `"reclamations"` au type `AppModule`, `ALL_MODULES` et `MODULE_LABELS` ("Reclamations")

---

## 3. Page publique : `src/pages/ReclamationPublic.tsx`

Formulaire public accessible via `/reclamation/:token`, sans authentification. Pattern identique a `Questionnaire.tsx` / `Evaluation.tsx` :

- Chargement de la reclamation par token (si existante, affiche confirmation "deja soumise")
- Si token valide et non soumis : formulaire avec les champs :
  - Nom / structure (pre-rempli si lie a un training/mission)
  - Email
  - Canal (select)
  - Type de probleme (select)
  - Description (textarea)
  - Gravite estimee (radio)
- Soumission : update de la ligne `reclamations` avec les donnees du formulaire, passage du status a `open`
- Page de confirmation apres soumission
- Logo Supertilt en haut, lien politique de confidentialite en bas

---

## 4. Page interne : `src/pages/Reclamations.tsx`

Page admin (authentifiee) avec :

- **Stats** : cartes ouvertes / en cours / cloturees
- **Filtres** : statut, type de probleme, gravite
- **Liste** des reclamations avec badges (gravite, statut, canal)
- **Bouton "Nouvelle reclamation"** : dialog pour creer manuellement (genere un token pour le lien public)
- **Bouton "Generer un lien de reclamation"** : cree une ligne vide avec un token, copie le lien `/reclamation/:token` dans le presse-papier pour l'envoyer au client
- **Detail / edition** : drawer ou section inline pour :
  - Voir la fiche complete
  - Ajouter les actions decidees, la reponse, le resume Qualiopi
  - Changer le statut
  - **Bouton "Assistance IA"** qui genere analyse + brouillon de reponse + resume Qualiopi
- **Export registre** : bouton pour copier un tableau recapitulatif (date | client | type | gravite | actions | statut)

---

## 5. Edge function IA : `supabase/functions/reclamation-ai-assist/index.ts`

- Actions : `analyze`, `draft_response`, `qualiopi_summary`, `annual_report`
- Utilise Lovable AI Gateway (`google/gemini-2.5-flash`)
- Prompts en francais, contexte petit organisme de formation
- CORS + verify_jwt = false

---

## 6. Routing (`src/App.tsx`)

- Lazy imports : `ReclamationPublic`, `Reclamations`
- Routes :
  - `/reclamation/:token` -- formulaire public
  - `/reclamations` -- page interne

---

## 7. Dashboard (`src/pages/Dashboard.tsx`)

- Nouvelle tuile "Reclamations" avec icone `MessageSquareWarning` et module `"reclamations"`

---

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Table `reclamations`, RLS, enum, trigger |
| `src/hooks/useModuleAccess.ts` | Ajout module |
| `src/pages/ReclamationPublic.tsx` | Creation -- formulaire public |
| `src/pages/Reclamations.tsx` | Creation -- page admin |
| `supabase/functions/reclamation-ai-assist/index.ts` | Creation -- edge function IA |
| `src/App.tsx` | Ajout 2 routes + lazy imports |
| `src/pages/Dashboard.tsx` | Ajout tuile |

---

## Workflow complet

1. Le formateur ouvre le module Reclamations et clique "Generer un lien"
2. Un token est cree en base, le lien `/reclamation/:token` est copie
3. Le formateur envoie ce lien au client (par mail, message, etc.)
4. Le client remplit le formulaire public (nom, email, description, type, gravite)
5. Le formateur voit la reclamation apparaitre dans sa liste
6. Il clique "Assistance IA" pour obtenir une analyse et un brouillon de reponse
7. Il adapte, envoie la reponse, genere le resume Qualiopi et cloture
8. En fin d'annee, il genere le bilan annuel

