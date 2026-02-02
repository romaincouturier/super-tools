

# Plan d'implementation : Outil de collaboration marketing SuperTilt

## Resume du projet

Un outil de collaboration marketing pour Emmanuelle et Romain permettant de piloter le contenu de SuperTilt. Ce plan integre les clarifications suivantes :

- **Acces multi-utilisateurs** : Romain@supertilt.fr est administrateur et peut donner des acces par module
- **WP Statistics** : API prevue mais en phase 2 (non implemente maintenant)
- **Historisation** : Non requise, on reste simple

---

## Phase 0 : Systeme de permissions par module

### 0.1 Architecture des permissions

Conformement aux bonnes pratiques de securite, les roles sont stockes dans une table separee (jamais dans le profil utilisateur).

```text
┌─────────────────────────────────────────────────────────────────────┐
│ user_module_access                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ id (uuid)                                                            │
│ user_id (uuid) - reference auth.users                               │
│ module (enum) - micro_devis, formations, evaluations, certificates, │
│                 ameliorations, historique, contenu                   │
│ granted_by (uuid) - qui a donne l'acces                             │
│ granted_at (timestamp)                                               │
│ UNIQUE (user_id, module)                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 0.2 Fonction de verification des acces

```sql
-- Fonction SECURITY DEFINER pour verifier l'acces sans recursion RLS
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_module_access
    WHERE user_id = _user_id AND module = _module::app_module
  )
  OR EXISTS (
    -- Romain a toujours acces a tout
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND email = 'romain@supertilt.fr'
  )
$$;
```

### 0.3 Interface d'administration des acces

Dans la page Parametres (`/parametres`), un nouvel onglet "Acces utilisateurs" visible uniquement pour Romain :
- Liste des utilisateurs avec leurs modules actives
- Activation/desactivation par module via des switches
- Visible uniquement si l'utilisateur connecte est romain@supertilt.fr

### 0.4 Modification du Dashboard

Le Dashboard filtre les outils affiches selon les permissions de l'utilisateur connecte :
- Appel a `has_module_access()` pour chaque module
- Les modules non autorises ne s'affichent pas
- Romain voit tous les modules

### 0.5 Modification de Auth.tsx

Suppression de la restriction `ALLOWED_EMAIL` :
- Tout utilisateur cree via le systeme d'onboarding peut se connecter
- Le controle d'acces se fait ensuite par module

---

## Phase 1 : Infrastructure de base du module Contenu

### 1.1 Schema de base de donnees

```text
┌─────────────────────────────────────────────────────────────────────┐
│ content_columns                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ id, name, display_order, is_system (pour Idees/Archive),           │
│ created_by, created_at                                               │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ content_cards                                                        │
├─────────────────────────────────────────────────────────────────────┤
│ id, column_id, title, description (texte riche),                    │
│ image_url, tags (JSONB array), display_order,                       │
│ created_by, created_at, updated_at                                   │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ content_reviews                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ id, card_id, reviewer_id, external_url (optionnel),                 │
│ status (pending/in_review/approved/changes_requested),              │
│ created_by, created_at, completed_at                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ review_comments                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ id, review_id, parent_comment_id (pour threads),                    │
│ author_id, content, created_at                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ content_notifications                                                │
├─────────────────────────────────────────────────────────────────────┤
│ id, user_id, type, reference_id, message, read_at, created_at       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ ai_brand_settings                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ id, setting_type (supertilt_voice/romain_voice),                    │
│ content, updated_by, updated_at                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Politiques RLS pour le module Contenu

Toutes les tables du module Contenu utilisent `has_module_access(auth.uid(), 'contenu')` pour controler l'acces.

### 1.3 Nouvelle route et navigation

- Ajout de `/contenu` dans App.tsx
- Nouvelle entree "Contenu" dans le Dashboard (visible si acces autorise)

---

## Phase 2 : Tableau Kanban

### 2.1 Composants principaux

```text
src/pages/ContentBoard.tsx           <- Page principale
src/components/content/
├── KanbanBoard.tsx                  <- Conteneur du tableau
├── KanbanColumn.tsx                 <- Colonne avec drag-drop
├── ContentCard.tsx                  <- Carte de contenu
├── ContentCardDialog.tsx            <- Modal d'edition de carte
├── ColumnSettingsDialog.tsx         <- Gestion des colonnes
└── AddColumnDialog.tsx              <- Ajout de colonne
```

### 2.2 Bibliotheque de drag-and-drop

Installation de `@dnd-kit/core` et `@dnd-kit/sortable` pour le drag-drop.

### 2.3 Fonctionnalites du Kanban

- Colonnes par defaut : "Idees" (premiere position) et "Archive" (derniere)
- Colonnes personnalisables : creation, renommage, reordonnancement
- Cartes avec titre, description riche, image de previsualisation, tags colores
- Drag-and-drop des cartes entre colonnes

### 2.4 Stockage des images

Bucket Supabase Storage `content-images` pour les visuels des cartes.

---

## Phase 3 : Systeme de relecture

### 3.1 Composants

```text
src/components/content/
├── ReviewRequestDialog.tsx          <- Demander une relecture
├── ReviewPanel.tsx                  <- Panneau de relecture
├── CommentThread.tsx                <- Thread de commentaires
├── CommentInput.tsx                 <- Saisie de commentaire
└── ReviewBadge.tsx                  <- Badge statut relecture
```

### 3.2 Workflow de relecture

1. Bouton "Demander une relecture" depuis une carte
2. Selection du relecteur (Emmanuelle ou Romain)
3. Option : contenu de la carte OU lien externe
4. Notification au relecteur
5. Echanges via commentaires
6. Statuts : En attente > En cours > Approuve / Modifications demandees

### 3.3 Notifications

- Table `content_notifications` pour les notifications in-app
- Realtime Supabase pour afficher un badge
- Edge Function `send-content-notification` pour les emails

---

## Phase 4 : Assistance IA

### 4.1 Recherche semantique dans les idees

Edge Function : `search-content-ideas`
- Question en langage naturel
- Analyse par Gemini du contenu des cartes "Idees"
- Retourne les cartes pertinentes

### 4.2 Reformulation et declinaisons

Edge Function : `ai-content-assist`
- Actions : reformuler, adapter pour blog, LinkedIn, Instagram
- Utilise les parametres de voix depuis `ai_brand_settings`

### 4.3 Parametrage editorial

Nouvel onglet "IA Marketing" dans Parametres :
- Champ pour la voix SuperTilt
- Champ pour la voix Romain Couturier

---

## Phase 5 : Tableau de bord operationnel

### 5.1 Composant

```text
src/components/content/ContentDashboard.tsx
```

### 5.2 Metriques

- Vue hebdomadaire
- Contenus publies, en cours, planifies
- Relectures en attente

---

## Resume des fichiers a creer/modifier

### Migrations SQL

| Migration | Description |
|-----------|-------------|
| `create_app_module_enum.sql` | Enum des modules |
| `create_user_module_access.sql` | Table des acces par module |
| `create_has_module_access_function.sql` | Fonction de verification |
| `create_content_columns.sql` | Table des colonnes Kanban |
| `create_content_cards.sql` | Table des cartes |
| `create_content_reviews.sql` | Table des relectures |
| `create_review_comments.sql` | Table des commentaires |
| `create_content_notifications.sql` | Table des notifications |
| `create_ai_brand_settings.sql` | Parametres voix IA |
| `create_content_images_bucket.sql` | Bucket storage |

### Pages

| Fichier | Description |
|---------|-------------|
| `src/pages/ContentBoard.tsx` | Page principale Kanban |

### Composants

| Fichier | Description |
|---------|-------------|
| `src/components/content/KanbanBoard.tsx` | Conteneur Kanban |
| `src/components/content/KanbanColumn.tsx` | Colonne draggable |
| `src/components/content/ContentCard.tsx` | Carte de contenu |
| `src/components/content/ContentCardDialog.tsx` | Edition de carte |
| `src/components/content/ReviewRequestDialog.tsx` | Demande de relecture |
| `src/components/content/ReviewPanel.tsx` | Panneau de relecture |
| `src/components/content/CommentThread.tsx` | Thread de commentaires |
| `src/components/content/AiIdeasSearch.tsx` | Recherche IA |
| `src/components/content/AiAssistPanel.tsx` | Assistance IA |
| `src/components/content/ContentDashboard.tsx` | Tableau de bord |
| `src/components/settings/UserAccessManager.tsx` | Gestion des acces (admin) |

### Edge Functions

| Fichier | Description |
|---------|-------------|
| `supabase/functions/search-content-ideas/index.ts` | Recherche semantique |
| `supabase/functions/ai-content-assist/index.ts` | Reformulation IA |
| `supabase/functions/send-content-notification/index.ts` | Emails de notification |

### Fichiers a modifier

| Fichier | Modification |
|---------|--------------|
| `src/App.tsx` | Ajout route `/contenu` |
| `src/pages/Dashboard.tsx` | Filtrage des modules selon permissions |
| `src/pages/Auth.tsx` | Suppression restriction email unique |
| `src/pages/Parametres.tsx` | Ajout onglet "Acces utilisateurs" + "IA Marketing" |

---

## Dependances a ajouter

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

---

## Ordre d'implementation recommande

1. **Sprint 1** : Systeme de permissions (tables, fonction, interface admin)
2. **Sprint 2** : Kanban de base (colonnes, cartes, drag-drop)
3. **Sprint 3** : Edition enrichie des cartes (description riche, images, tags)
4. **Sprint 4** : Systeme de relecture et commentaires
5. **Sprint 5** : Notifications in-app et email
6. **Sprint 6** : Recherche IA dans les idees
7. **Sprint 7** : Assistance IA (reformulation, declinaisons)
8. **Sprint 8** : Tableau de bord operationnel

---

## Securite

- Fonction `has_module_access` en SECURITY DEFINER pour eviter les recursions RLS
- Romain@supertilt.fr a un acces automatique a tous les modules (bypass dans la fonction)
- Chaque table du module Contenu verifie l'acces via cette fonction
- Les autres modules existants (formations, evaluations, etc.) conservent leur logique actuelle mais pourront etre integres au systeme de permissions

