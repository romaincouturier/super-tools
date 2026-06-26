# Spec — Boîte à idées (SuperTools)

Statut : proposée · Décisions actées : **module dédié + promotion** (A1), **IA en tâche de fond** (B1).

## 1. Objectif & principe
Permettre à un membre de l'équipe de **pousser une idée en quelques secondes** dans SuperTools : un titre descriptif, éventuellement une image et une note. L'idée est ensuite triée, enrichie automatiquement, priorisée par votes, puis — si elle est retenue — **promue en amélioration** (backlog d'exécution existant).

Non-objectifs : remplacer le module Améliorations (exécution) ou la colonne support « Boîte à idées » (problèmes/tickets). La boîte à idées est l'**amont** : capture + tri.

## 2. Positionnement (A1)
Nouveau module léger **`ideas`**, distinct de :
- **Améliorations** (`improvements`) : backlog curé et exécuté. → cible de la **promotion**.
- **Support** (`boite_a_idees`) : tickets réactifs. → inchangé.

Promotion : bouton « Promouvoir en amélioration » qui crée une ligne `improvements` avec `source_type = 'idea'`, `source_id = ideas.id`, et bascule l'idée en statut `promue`. Aucun pipeline d'exécution dupliqué.

## 3. Modèle de données

```sql
-- Table principale
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  tags text[] default '{}',
  status text not null default 'nouvelle'
    check (status in ('nouvelle','a_l_etude','acceptee','promue','realisee','rejetee')),
  votes integer not null default 0,
  -- enrichissement IA (rempli en tâche de fond)
  embedding vector(1536),
  ai_category text,
  ai_impact text,            -- faible / moyen / fort
  ai_effort text,            -- faible / moyen / fort
  ai_summary text,
  ai_enriched_at timestamptz,
  -- promotion
  promoted_to_improvement_id uuid references public.improvements(id) on delete set null,
  created_by uuid,
  org_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ideas_status_idx on public.ideas (status);
create index ideas_embedding_idx on public.ideas using ivfflat (embedding vector_cosine_ops);

-- Votes (multi-utilisateur, 1 vote par personne et par idée)
create table public.idea_votes (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- RLS : staff uniquement (mirroir improvements)
alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;
-- policies select/insert/update/delete TO authenticated (staff) — à calquer sur improvements
```

Bucket storage `ideas` (images + PDF), `allowed_mime_types` incluant `application/pdf`, `file_size_limit` 50 Mo (calqué sur `watch`).

## 4. Parcours utilisateur

### 4.1 Capture (friction minimale)
- Bouton global **« 💡 Nouvelle idée »** (page Idées + accès rapide).
- Champs : **titre** (obligatoire), description (option), **image** (option), tags (option).
- Dictée vocale via `VoiceDictationButton` (déjà existant).
- Upload image via edge function **`upload-idea-file`** (calquée sur `upload-watch-file`, règle 026 — pas de storage direct).

### 4.2 Anti-doublon (« y a-t-il mieux ? »)
- À l'ouverture du formulaire, au fil de la frappe du titre : appel léger renvoyant les **idées + améliorations proches** (similarité d'embedding) → bloc « Idées proches » avec bouton **👍 voter** plutôt que créer un doublon.
- Implémentation : RPC de similarité (cosine) sur `ideas.embedding` + `improvements` (si embeddings dispo) — sinon match texte trigram en repli.

### 4.3 Tri & priorisation
- **Kanban** (`GenericKanbanBoard`) par statut.
- **Votes** 👍 (table `idea_votes`).
- **Dialog Statistiques** réutilisé (`KanbanStatsDialog`) : flux cumulé, flux de valeur (impact pondéré), carte de contrôle.

### 4.4 Promotion
- Bouton « Promouvoir en amélioration » → crée `improvements` (`source_type='idea'`, `source_id`), statut idée → `promue`, lien `promoted_to_improvement_id`.

## 5. Enrichissement IA en tâche de fond (B1)
La capture **ne bloque jamais** sur l'IA. Après création, une edge function **`enrich-idea`** (déclenchée à l'insert ou par cron, comme la veille) :
1. calcule l'**embedding** (`text-embedding-3-small`, comme `index-documents`) ;
2. via le helper **`_shared/ai.ts`** (provider-agnostique) : **catégorie**, reformulation propre du titre, **impact/effort** (RICE-lite), `ai_summary` ;
3. détecte les **doublons / regroupements thématiques** (clustering, pattern `watch-cluster-analysis`).

Rien n'est écrasé côté utilisateur : les champs `ai_*` sont séparés des champs saisis ; l'utilisateur garde la main.

## 6. Alertes
- **Quotidien** : section ajoutée à `generate-daily-actions` → « 💡 X idées à trier » (uniquement s'il y a des idées `nouvelle` non triées).
- **Hebdo** : digest « Top idées de la semaine » (par votes / impact) + clusters émergents (réutilise `process-daily-summary` / Slack).

## 7. Réutilisation (peu de neuf)
| Besoin | Réutilise |
|---|---|
| Upload image/PDF | pattern `upload-watch-file` → `upload-idea-file` |
| Embeddings / similarité | `text-embedding-3-small` (`index-documents`, watch) |
| Enrichissement / clustering IA | `_shared/ai.ts`, pattern `watch-cluster-analysis` |
| Kanban + stats | `GenericKanbanBoard`, `KanbanStatsDialog` |
| Dictée | `VoiceDictationButton` |
| Alertes | `generate-daily-actions`, `process-daily-summary` |
| Promotion | table `improvements` (`source_type='idea'`) |

## 8. À créer
- **DB** : migration `ideas` + `idea_votes` + bucket `ideas` + RLS + RPC similarité.
- **Edge functions** : `upload-idea-file`, `enrich-idea`.
- **Front** : page `Ideas` (kanban + liste), `IdeaFormDialog` (capture + anti-doublon), `IdeaCard`, `IdeaDetailDrawer`, hook `useIdeas`.
- **Intégrations** : section idées dans `generate-daily-actions` ; bouton promotion.

## 9. Découpage en lots livrables
1. **MVP capture** : table + RLS + bucket + `upload-idea-file` + page/kanban + formulaire (titre/image/desc) + votes + promotion. (Sans IA.)
2. **Anti-doublon + stats** : embeddings + RPC similarité + bloc « idées proches » + `KanbanStatsDialog`.
3. **Enrichissement IA** : `enrich-idea` (catégorie/impact/effort/clusters) en tâche de fond.
4. **Alertes** : section quotidienne + digest hebdo.

## 10. Décisions ouvertes
- Votes : un seul par personne (proposé) ou pondérés ?
- Statut de départ visible de tous, ou modération avant publication ?
- Impact/effort : libre IA, ou échelle imposée pour scoring ?
- Promotion : copier l'image vers le module Améliorations ou garder le lien ?
