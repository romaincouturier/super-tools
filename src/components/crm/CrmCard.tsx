import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GraduationCap, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CrmCard, CrmColumn } from "@/types/crm";
import { useUpdateCard } from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";

interface ServiceTypeColors {
  formation: string;
  mission: string;
  default: string;
}

interface CrmCardProps {
  card: CrmCard;
  isDragging?: boolean;
  allColumns?: CrmColumn[];
  onClick?: () => void;
  serviceTypeColors?: ServiceTypeColors;
}

const DEFAULT_COLORS: ServiceTypeColors = {
  formation: "#3b82f6",
  mission: "#8b5cf6",
  default: "#6b7280",
};

const CrmCardComponent = ({ card, isDragging, onClick, serviceTypeColors }: CrmCardProps) => {
  const { user } = useAuth();
  const updateCard = useUpdateCard();
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState(String(card.estimated_value || 0));

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const colors = serviceTypeColors || DEFAULT_COLORS;
  const cardColor = card.service_type
    ? colors[card.service_type] || colors.default
    : colors.default;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const handleValueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingValue(true);
    setEditValue(String(card.estimated_value || 0));
  };

  const handleValueSave = async () => {
    if (!user?.email) return;
    const newValue = Math.round((parseFloat(editValue) || 0) * 100) / 100;
    if (newValue !== card.estimated_value) {
      await updateCard.mutateAsync({
        id: card.id,
        updates: { estimated_value: newValue },
        actorEmail: user.email,
        oldCard: card,
      });
    }
    setIsEditingValue(false);
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleValueSave();
    } else if (e.key === "Escape") {
      setIsEditingValue(false);
    }
  };

  const handleEmojiChange = async (emoji: string | null) => {
    if (!user?.email) return;
    await updateCard.mutateAsync({
      id: card.id,
      updates: { emoji },
      actorEmail: user.email,
      oldCard: card,
    });
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-emoji-picker]')) return;
    onClick?.();
  };

  return (
    <Card
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftWidth: "4px",
        borderLeftColor: cardColor,
      }}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow touch-none ${isDragging ? "shadow-lg" : ""}`}
      onClick={handleCardClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Drag handle + Service type + Value */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {/* Service type indicator */}
            {card.service_type ? (
              <div
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: cardColor }}
              >
                {card.service_type === "formation" ? (
                  <GraduationCap className="h-3 w-3" />
                ) : (
                  <Briefcase className="h-3 w-3" />
                )}
                {card.service_type === "formation" ? "Formation" : "Mission"}
              </div>
            ) : null}
          </div>

          {/* Estimated value - clickable to edit */}
          {isEditingValue ? (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleValueSave}
              onKeyDown={handleValueKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-24 text-xs text-right"
              autoFocus
            />
          ) : (
            <div
              className="text-xs font-semibold text-green-700 bg-green-50 rounded px-2 py-0.5 cursor-pointer hover:bg-green-100 transition-colors"
              onClick={handleValueClick}
              title="Cliquer pour modifier"
            >
              {Number(card.estimated_value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
            </div>
          )}
        </div>

        {/* Confidence score mini bar */}
        {card.confidence_score !== null && card.confidence_score !== undefined && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  card.confidence_score >= 70
                    ? "bg-green-500"
                    : card.confidence_score >= 40
                    ? "bg-orange-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${card.confidence_score}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium ${
              card.confidence_score >= 70
                ? "text-green-600"
                : card.confidence_score >= 40
                ? "text-orange-600"
                : "text-red-600"
            }`}>
              {card.confidence_score}%
            </span>
          </div>
        )}

        {/* Title */}
        <div className="flex items-start gap-1">
          <span data-emoji-picker>
            <EmojiPickerButton
              emoji={card.emoji}
              onEmojiChange={handleEmojiChange}
              size="sm"
              className="shrink-0 mt-0.5"
            />
          </span>
          <div className="font-medium text-sm line-clamp-2">{card.title}</div>
        </div>

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs py-0"
                style={{ backgroundColor: tag.color + "20", color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {card.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs py-0">
                +{card.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrmCardComponent;
