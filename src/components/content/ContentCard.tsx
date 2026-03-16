import React from "react";
import { MoreHorizontal, Pencil, Trash2, Eye, Mail } from "lucide-react";
import type { ContentTypeColors } from "./KanbanBoard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Card } from "./KanbanBoard";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { useSortableCard } from "@/hooks/useSortableCard";
import CardTagList from "@/components/shared/kanban/CardTagList";

interface ContentCardProps {
  card: Card;
  isDragging?: boolean;
  typeColors?: ContentTypeColors;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onEmojiChange?: (cardId: string, emoji: string | null) => void;
}

const tagColors = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
];

const getTagColor = (tag: string) => {
  const index = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tagColors[index % tagColors.length];
};

const ContentCard = ({ card, isDragging: isDraggingProp, typeColors, onEdit, onDelete, onView, onEmojiChange }: ContentCardProps) => {
  const { ref, style, attributes, listeners, isDragging } = useSortableCard(card.id, isDraggingProp);
  const borderColor = typeColors?.[card.card_type] || (card.card_type === "post" ? "#a855f7" : "#3b82f6");

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-radix-dropdown-menu-trigger]') || target.closest('[role="menu"]') || target.closest('[data-emoji-picker]')) {
      return;
    }
    if (onView) {
      onView();
    }
  };

  const tags = (card.tags || []).map((tag) => ({
    key: tag,
    label: tag,
    className: getTagColor(tag),
  }));

  // Add newsletter tag if present
  if (card.newsletter_name) {
    tags.unshift({
      key: "__newsletter__",
      label: `📬 ${card.newsletter_name}`,
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    });
  }

  return (
    <div
      ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-card border rounded-lg overflow-hidden cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${
        isDragging ? "opacity-50 shadow-lg rotate-2" : ""
      }`}
      onClick={handleCardClick}
    >
      {/* Color indicator bar */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: borderColor }}
      />

      {card.image_url && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={card.image_url}
            alt={card.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1 flex-1 min-w-0">
            <span data-emoji-picker>
              <EmojiPickerButton
                emoji={card.emoji}
                onEmojiChange={(emoji) => onEmojiChange?.(card.id, emoji)}
                size="sm"
                className="shrink-0 mt-0.5"
              />
            </span>
            <h4 className="font-medium text-sm line-clamp-2">{card.title}</h4>
          </div>

          {(onEdit || onDelete || onView) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={onView}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {card.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {card.description.replace(/<[^>]*>/g, "")}
          </p>
        )}

        <CardTagList tags={tags} className="mt-2" />
        </div>
    </div>
  );
};

export default React.memo(ContentCard);
