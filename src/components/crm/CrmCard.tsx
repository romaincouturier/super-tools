import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Calendar, DollarSign, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrmCard, CrmColumn, SalesStatus } from "@/types/crm";
import { useMoveCard } from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CrmCardProps {
  card: CrmCard;
  isDragging?: boolean;
  allColumns?: CrmColumn[];
  onClick?: () => void;
}

const salesStatusColors: Record<SalesStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
  CANCELED: "bg-gray-100 text-gray-800",
};

const salesStatusLabels: Record<SalesStatus, string> = {
  OPEN: "En cours",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELED: "Annulé",
};

const CrmCardComponent = ({ card, isDragging, allColumns, onClick }: CrmCardProps) => {
  const { user } = useAuth();
  const moveCard = useMoveCard();

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

  const handleColumnChange = (newColumnId: string) => {
    if (newColumnId === card.column_id || !user?.email) return;
    moveCard.mutate({
      cardId: card.id,
      newColumnId,
      newPosition: 0,
      actorEmail: user.email,
      oldColumnId: card.column_id,
    });
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

        {/* Column selector in header */}
        {allColumns && allColumns.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={card.column_id} onValueChange={handleColumnChange}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allColumns.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Status badges */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={salesStatusColors[card.sales_status]}>
            {salesStatusLabels[card.sales_status]}
          </Badge>
          {card.status_operational === "WAITING" && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800">
              <Clock className="h-3 w-3 mr-1" />
              En attente
            </Badge>
          )}
        </div>

        {/* Waiting info */}
        {card.status_operational === "WAITING" && card.waiting_next_action_date && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(card.waiting_next_action_date), "d MMM yyyy", { locale: fr })}
            {card.waiting_next_action_text && (
              <span className="truncate"> - {card.waiting_next_action_text}</span>
            )}
          </div>
        )}

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
