import type { ReactNode } from "react";
import type { CollisionDetection } from "@dnd-kit/core";

export interface KanbanColumnDef {
  id: string;
  name: string;
  position: number;
  color?: string;
}

export interface KanbanCardDef {
  id: string;
  columnId: string;
  position: number;
}

export interface KanbanDropResult<TCard> {
  card: TCard;
  sourceColumnId: string;
  targetColumnId: string;
  newPosition: number;
}

export interface KanbanBoardConfig {
  cardSortable?: boolean;
  enableKeyboard?: boolean;
  collisionDetection?: CollisionDetection;
}

export interface GenericKanbanBoardProps<
  TCard extends KanbanCardDef,
  TColumn extends KanbanColumnDef,
> {
  columns: TColumn[];
  cards: TCard[];
  loading?: boolean;

  config?: KanbanBoardConfig;

  renderCard: (card: TCard, isDragging?: boolean) => ReactNode;
  renderColumnHeader?: (column: TColumn, cards: TCard[]) => ReactNode;
  renderEmptyColumn?: (column: TColumn) => ReactNode;

  onCardMove: (result: KanbanDropResult<TCard>) => void | Promise<void>;

  onCardClick?: (card: TCard) => void;

  columnClassName?: string;
  boardClassName?: string;
}
