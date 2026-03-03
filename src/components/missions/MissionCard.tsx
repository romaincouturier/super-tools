import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Building2, Euro } from "lucide-react";
import { Mission } from "@/types/missions";
import { cn } from "@/lib/utils";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { useSortableCard } from "@/hooks/useSortableCard";
import CardTagList from "@/components/shared/kanban/CardTagList";

interface MissionCardProps {
  mission: Mission;
  isDragging?: boolean;
  onClick?: () => void;
  onEmojiChange?: (missionId: string, emoji: string | null) => void;
}

const MissionCard = ({ mission, isDragging: isDraggingProp, onClick, onEmojiChange }: MissionCardProps) => {
  const { ref, style, attributes, listeners, isDragging } = useSortableCard(mission.id, isDraggingProp);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-emoji-picker]')) return;
    onClick?.();
  };

  const tags = (mission.tags || []).map((tag, i) => ({
    key: String(i),
    label: tag,
    className: "bg-muted text-foreground",
  }));

  return (
    <div
      ref={ref}
      style={{ ...style, borderLeftColor: mission.color }}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "p-3 bg-card border rounded-lg cursor-pointer transition-all hover:shadow-md",
        "border-l-4",
        isDragging && "opacity-50 shadow-lg rotate-2"
      )}
    >
      {/* Title */}
      <div className="flex items-start gap-1 mb-2">
        <span data-emoji-picker>
          <EmojiPickerButton
            emoji={mission.emoji}
            onEmojiChange={(emoji) => onEmojiChange?.(mission.id, emoji)}
            size="sm"
            className="shrink-0 mt-0.5"
          />
        </span>
        <h4 className="font-medium text-sm line-clamp-2">{mission.title}</h4>
      </div>

      {/* Client */}
      {mission.client_name && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{mission.client_name}</span>
        </div>
      )}

      {/* Dates */}
      {(mission.start_date || mission.end_date) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Calendar className="h-3 w-3" />
          <span>
            {mission.start_date && format(new Date(mission.start_date), "d MMM", { locale: fr })}
            {mission.start_date && mission.end_date && " - "}
            {mission.end_date && format(new Date(mission.end_date), "d MMM yyyy", { locale: fr })}
          </span>
        </div>
      )}

      {/* Amount */}
      {mission.total_amount && (
        <div className="flex items-center gap-1 text-xs font-medium text-primary">
          <Euro className="h-3 w-3" />
          <span>{mission.total_amount.toLocaleString("fr-FR")} €</span>
        </div>
      )}

      {/* Tags */}
      <CardTagList tags={tags} className="mt-2" renderTag={(tag) => (
        <span key={tag.key} className="px-1.5 py-0.5 text-[10px] bg-muted rounded">
          {tag.label}
        </span>
      )} />
    </div>
  );
};

export default MissionCard;
