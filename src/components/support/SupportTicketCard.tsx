import { Bug, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSortableCard } from "@/hooks/useSortableCard";
import {
  TICKET_TYPE_CONFIG,
  TICKET_PRIORITY_CONFIG,
  type SupportTicketCard as SupportTicketCardType,
} from "@/types/support";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  card: SupportTicketCardType;
  isDragging?: boolean;
}

export default function SupportTicketCard({ card, isDragging: isDraggingProp }: Props) {
  const { ref, style, attributes, listeners, isDragging } = useSortableCard(card.id, isDraggingProp);
  const t = card.ticket;
  const typeConf = TICKET_TYPE_CONFIG[t.type];
  const prioConf = TICKET_PRIORITY_CONFIG[t.priority];

  return (
    <div
      ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing space-y-2 ${
        isDragging ? "opacity-50 shadow-lg rotate-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" style={{ borderColor: typeConf.color, color: typeConf.color }} className="text-[10px] px-1.5 py-0">
            {t.type === "bug" ? <Bug className="h-2.5 w-2.5 mr-0.5" /> : <Lightbulb className="h-2.5 w-2.5 mr-0.5" />}
            {typeConf.label}
          </Badge>
          <Badge variant="outline" style={{ borderColor: prioConf.color, color: prioConf.color }} className="text-[10px] px-1.5 py-0">
            {prioConf.label}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.ticket_number}</span>
      </div>
      <p className="text-sm font-medium leading-tight line-clamp-2">{t.title}</p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{t.submitted_by_email?.split("@")[0] || "—"}</span>
        <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}</span>
      </div>
    </div>
  );
}
