import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Building2, Euro } from "lucide-react";
import { Mission } from "@/types/missions";
import { cn } from "@/lib/utils";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";

interface MissionCardProps {
  mission: Mission;
  isDragging?: boolean;
  onClick?: () => void;
  onEmojiChange?: (missionId: string, emoji: string | null) => void;
}

const MissionCard = ({ mission, isDragging, onClick, onEmojiChange }: MissionCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: mission.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  const combinedStyle = {
    ...style,
    borderLeftColor: mission.color,
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-emoji-picker]')) return;
    onClick?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={combinedStyle}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={cn(
        "p-3 bg-card border rounded-lg cursor-pointer transition-all hover:shadow-md",
        "border-l-4",
        dragging && "opacity-50 shadow-lg rotate-2"
      )}
    >
      {/* Title */}
      <div className="flex items-start gap-1 mb-2" data-emoji-picker>
        <EmojiPickerButton
          emoji={mission.emoji}
          onEmojiChange={(emoji) => onEmojiChange?.(mission.id, emoji)}
          size="sm"
          className="shrink-0 mt-0.5"
        />
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
      {mission.tags && mission.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {mission.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-1.5 py-0.5 text-[10px] bg-muted rounded"
            >
              {tag}
            </span>
          ))}
          {mission.tags.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{mission.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MissionCard;
