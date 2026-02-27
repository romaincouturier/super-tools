# Plan de refactoring : GenericKanbanBoard

## Objectif
Remplacer les 4 boards Kanban dupliqués (CRM, Missions, Contenu, Améliorations) par un seul composant `GenericKanbanBoard` paramétrable, instancié dans chaque contexte.

---

## Etape 1 : Créer le composant AddColumnDialog partagé

**Fichiers à créer :** `src/components/shared/AddColumnDialog.tsx`
**Fichiers à modifier :** `CrmKanbanBoard.tsx`, `content/KanbanBoard.tsx`
**Fichiers à supprimer :** `src/components/crm/AddColumnDialog.tsx`, `src/components/content/AddColumnDialog.tsx`

Les 2 AddColumnDialog existants sont quasi identiques (même props, même logique, 3 lignes de diff). Fusion en un seul fichier partagé, puis mise à jour des imports.

---

## Etape 2 : Créer le hook `useKanbanDnd`

**Fichier à créer :** `src/hooks/useKanbanDnd.ts`

Extraire la config DnD commune (identique dans les 4 boards) :
- `PointerSensor` avec `activationConstraint: { distance: 8 }`
- `KeyboardSensor` optionnel (CRM + Content l'utilisent)
- `closestCorners` par défaut (seul Missions utilise `closestCenter`)

```ts
interface UseKanbanDndOptions {
  enableKeyboard?: boolean;
}
// Retourne { sensors }
```

---

## Etape 3 : Créer les types génériques du board

**Fichier à créer :** `src/types/kanban.ts`

```ts
interface KanbanColumnDef {
  id: string;
  name: string;
  position: number;
  isSystem?: boolean;       // Content : protège rename/delete
  isArchived?: boolean;     // CRM : colonne archivée
  color?: string;           // Missions : dot de couleur
}

interface KanbanCardDef {
  id: string;
  columnId: string;         // rattachement à la colonne
  position: number;
}

interface KanbanDropResult<TCard> {
  card: TCard;
  sourceColumnId: string;
  targetColumnId: string;
  newPosition: number;
}

interface KanbanBoardConfig {
  columnReorder?: boolean;  // Content seul l'utilise
  cardSortable?: boolean;   // false pour Améliorations
  enableKeyboard?: boolean; // CRM + Content
  collisionDetection?: 'closestCorners' | 'closestCenter';
}
```

---

## Etape 4 : Créer le composant `GenericKanbanBoard`

**Fichier à créer :** `src/components/shared/kanban/GenericKanbanBoard.tsx`

Coeur du refactoring. Props :

```ts
interface GenericKanbanBoardProps<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef
> {
  // Données
  columns: TColumn[];
  cards: TCard[];
  loading?: boolean;

  // Config DnD
  config?: KanbanBoardConfig;

  // Rendu (render props)
  renderCard: (card: TCard, isDragging?: boolean) => ReactNode;
  renderColumnHeader?: (column: TColumn, cards: TCard[]) => ReactNode;
  renderColumnFooter?: (column: TColumn) => ReactNode;
  renderToolbar?: () => ReactNode;         // Search/filtres au-dessus du board
  renderAfterColumns?: () => ReactNode;    // Bouton "+" ajout colonne

  // Callbacks DnD
  onCardMove: (result: KanbanDropResult<TCard>) => void | Promise<void>;
  onBeforeCardMove?: (result: KanbanDropResult<TCard>) => boolean | Promise<boolean>;
    // → retourner false annule le move (ex: dialog raison de perte CRM)
  onAfterCardMove?: (result: KanbanDropResult<TCard>) => void;
    // → side effects post-move (ex: confetti CRM)
  onColumnReorder?: (columnId: string, newPosition: number) => void;

  // Clic carte
  onCardClick?: (card: TCard) => void;

  // Styles
  columnClassName?: string;
  boardClassName?: string;
}
```

**Responsabilités internes :**
1. `DndContext` + sensors (via `useKanbanDnd`)
2. Layout horizontal scrollable (`flex gap-4 overflow-x-auto`)
3. `SortableContext` pour colonnes (si `config.columnReorder`)
4. Pour chaque colonne : `useDroppable`, `SortableContext` cards, highlight `ring-2` au survol
5. `DragOverlay` avec `renderCard(activeCard, true)`
6. `handleDragStart` / `handleDragOver` / `handleDragEnd` génériques
7. `onBeforeCardMove` appelé avant persist (retourne false → annule)
8. `onAfterCardMove` appelé après persist

---

## Etape 5 : Créer le composant `GenericKanbanColumn`

**Fichier à créer :** `src/components/shared/kanban/GenericKanbanColumn.tsx`

Composant colonne interne utilisé par GenericKanbanBoard :
- `useDroppable` + optionnel `useSortable` (si `columnReorder`)
- Header : nom + badge count + slot extras (via `renderColumnHeader`)
- Zone scrollable pour les cards
- Empty state configurable
- Highlight au survol (`isOver`)

---

## Etape 6 : Migrer le board Améliorations (le plus simple)

**Fichier à modifier :** `src/components/ameliorations/ImprovementKanban.tsx`

Premier test du GenericKanbanBoard. C'est le board le plus simple : stateless, pas de sortable intra-colonne.

```tsx
<GenericKanbanBoard
  columns={KANBAN_COLUMNS.map(status => ({
    id: status,
    name: STATUS_CONFIG[status].label,
    position: idx,
    color: STATUS_CONFIG[status].color,
  }))}
  cards={allImprovements.map(i => ({ ...i, columnId: i.status, position: 0 }))}
  config={{ cardSortable: false }}
  renderCard={(item) => <ImprovementCard improvement={item} compact />}
  renderColumnHeader={(col, cards) => /* nom + count */}
  onCardMove={({ card, targetColumnId }) => onStatusChange(card.id, targetColumnId)}
  onCardClick={(item) => onClick(item)}
/>
```

**ImprovementCard.tsx reste inchangé.**

---

## Etape 7 : Migrer le board Missions

**Fichier à modifier :** `src/components/missions/MissionsKanbanBoard.tsx`
**Fichier à supprimer :** `src/components/missions/MissionColumn.tsx`

```tsx
<GenericKanbanBoard
  columns={statuses.map(s => ({
    id: s, name: missionStatusConfig[s].label,
    position: idx, color: missionStatusConfig[s].color,
  }))}
  cards={missions.map(m => ({ ...m, columnId: m.status }))}
  config={{ cardSortable: true, collisionDetection: 'closestCenter' }}
  renderCard={(m, isDragging) => <MissionCard mission={m} isDragging={isDragging} />}
  renderColumnHeader={(col) => /* nom + dot couleur + bouton "+" */}
  onCardMove={({ card, targetColumnId, newPosition }) =>
    moveMission.mutateAsync({ missionId: card.id, newStatus: targetColumnId, newPosition })
  }
  onCardClick={(m) => setSelectedMission(m)}
/>
```

**MissionCard.tsx reste inchangé.** CreateMissionDialog et MissionDetailDrawer restent gérés par le wrapper MissionsKanbanBoard.

---

## Etape 8 : Migrer le board Contenu

**Fichier à modifier :** `src/components/content/KanbanBoard.tsx`
**Fichier à supprimer :** `src/components/content/KanbanColumn.tsx`

Seul board avec réordonnement de colonnes et CRUD colonnes.

```tsx
<GenericKanbanBoard
  columns={columns.map(c => ({
    id: c.id, name: c.name,
    position: c.display_order, isSystem: c.is_system,
  }))}
  cards={cards.map(c => ({ ...c, columnId: c.column_id, position: c.display_order }))}
  config={{ columnReorder: true, cardSortable: true, enableKeyboard: true }}
  renderCard={(card, isDragging) => <ContentCard card={card} isDragging={isDragging} />}
  renderColumnHeader={(col) => /* grip handle + nom + dropdown rename/delete + bouton "+" */}
  renderAfterColumns={() => <Button onClick={() => setShowAddColumn(true)}>+</Button>}
  onCardMove={({ card, targetColumnId, newPosition }) => /* persist Supabase */}
  onColumnReorder={(colId, newPos) => /* persist Supabase */}
  onCardClick={(card) => setEditingCard(card)}
/>
```

**ContentCard.tsx reste inchangé.** ColorSettingsDialog et ContentCardDialog restent dans KanbanBoard.tsx.

---

## Etape 9 : Migrer le board CRM (le plus complexe)

**Fichier à modifier :** `src/components/crm/CrmKanbanBoard.tsx`
**Fichier à supprimer :** `src/components/crm/CrmColumn.tsx`

La logique métier la plus riche (search, filtres, confetti, dialogs). Toute cette logique reste dans CrmKanbanBoard.tsx — GenericKanbanBoard ne la connaît pas.

```tsx
<GenericKanbanBoard
  columns={columns}
  cards={localCards.map(c => ({ ...c, columnId: c.column_id }))}
  config={{ cardSortable: true, enableKeyboard: true }}
  renderToolbar={() => /* barre search + 5 boutons filtre */}
  renderCard={(card, isDragging) =>
    <CrmCard card={card} isDragging={isDragging} serviceTypeColors={...} />
  }
  renderColumnHeader={(col, cards) => /* nom + count + valeur totale + dropdown rename/archive */}
  renderAfterColumns={() => <Button>+ Colonne</Button>}
  onBeforeCardMove={async ({ card, targetColumnId }) => {
    const colName = getColumnName(targetColumnId);
    if (colName.includes("perdu")) {
      // Ouvre LossReasonDialog, retourne false → annule le move
      setPendingLossCard({ cardId: card.id, targetColumnId, ... });
      setShowLossReasonDialog(true);
      return false;
    }
    return true;
  }}
  onCardMove={({ card, targetColumnId, newPosition }) =>
    moveCard.mutateAsync({ cardId: card.id, targetColumnId, newPosition })
  }
  onAfterCardMove={({ card, targetColumnId }) => {
    const colName = getColumnName(targetColumnId);
    if (colName.includes("gagné")) {
      celebrateWin();
      // Propose création formation
    }
  }}
  onCardClick={(card) => setSelectedCard(card)}
/>
```

**CrmCard.tsx reste inchangé.** LossReasonDialog, CreateTrainingDialog, CardDetailDrawer restent gérés par CrmKanbanBoard.

---

## Etape 10 : Nettoyage final

- Supprimer les fichiers devenus inutiles :
  - `src/components/crm/CrmColumn.tsx`
  - `src/components/crm/AddColumnDialog.tsx`
  - `src/components/missions/MissionColumn.tsx`
  - `src/components/content/KanbanColumn.tsx`
  - `src/components/content/AddColumnDialog.tsx`
- Vérifier tous les imports (plus aucune référence aux anciens fichiers)
- `npx tsc --noEmit`
- Test visuel de chaque board

---

## Résumé des fichiers

| Action | Fichier |
|--------|---------|
| **Créer** | `src/components/shared/AddColumnDialog.tsx` |
| **Créer** | `src/hooks/useKanbanDnd.ts` |
| **Créer** | `src/types/kanban.ts` |
| **Créer** | `src/components/shared/kanban/GenericKanbanBoard.tsx` |
| **Créer** | `src/components/shared/kanban/GenericKanbanColumn.tsx` |
| **Modifier** | `src/components/ameliorations/ImprovementKanban.tsx` |
| **Modifier** | `src/components/missions/MissionsKanbanBoard.tsx` |
| **Modifier** | `src/components/content/KanbanBoard.tsx` |
| **Modifier** | `src/components/crm/CrmKanbanBoard.tsx` |
| **Supprimer** | `src/components/crm/AddColumnDialog.tsx` |
| **Supprimer** | `src/components/content/AddColumnDialog.tsx` |
| **Supprimer** | `src/components/missions/MissionColumn.tsx` |
| **Supprimer** | `src/components/content/KanbanColumn.tsx` |
| **Supprimer** | `src/components/crm/CrmColumn.tsx` |
| **Inchangé** | Tous les *Card.tsx (ImprovementCard, MissionCard, ContentCard, CrmCard) |
| **Inchangé** | Tous les drawers/dialogs de détail |

## Ordre d'exécution

Du plus simple au plus complexe : **Améliorations → Missions → Contenu → CRM**. Chaque étape produit un board fonctionnel et testable. Si un problème survient, on peut s'arrêter sans casser les autres boards.
