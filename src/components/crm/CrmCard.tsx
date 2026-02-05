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
    const newValue = parseFloat(editValue) || 0;
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
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "shadow-lg" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Service type + Value */}
        <div className="flex items-center justify-between gap-2">
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
          ) : (
            <div />
          )}

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
              {(card.estimated_value || 0).toLocaleString("fr-FR")} €
            </div>
          )}
        </div>

        {/* Title */}
        <div className="font-medium text-sm line-clamp-2">
          {card.emoji && <span className="mr-1">{card.emoji}</span>}
          {card.title}
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
