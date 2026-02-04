import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CrmCard, CrmColumn } from "@/types/crm";

interface CrmCardProps {
  card: CrmCard;
  isDragging?: boolean;
  allColumns?: CrmColumn[];
  onClick?: () => void;
}

const CrmCardComponent = ({ card, isDragging, onClick }: CrmCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "shadow-lg" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <div className="font-medium text-sm line-clamp-2">{card.title}</div>

        {/* Value */}
        {card.estimated_value > 0 && (
          <div className="text-xs font-medium flex items-center gap-1 text-green-700">
            <DollarSign className="h-3 w-3" />
            {card.estimated_value.toLocaleString("fr-FR")} €
          </div>
        )}

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
