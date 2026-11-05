import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DISPLAY_STATUS_LABELS,
  utcIsoToParisLocal,
  type CalendarCard,
  type SocialChannel,
  type SocialPublicationStatus,
} from "@/services/socialContents";

export const STATUS_DOT_CLASSES: Record<SocialPublicationStatus, string> = {
  unscheduled: "bg-muted-foreground/60",
  scheduled: "bg-blue-500",
  published: "bg-green-600",
};

interface ContentCardProps {
  card: CalendarCard;
  channelsById: Map<string, SocialChannel>;
  onOpen: (groupId: string) => void;
}

export default function ContentCard({ card, channelsById, onOpen }: ContentCardProps) {
  const published = card.status === "published";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.group.id, data: { card }, disabled: published });
  const text = (card.posts.find((p) => p.publication_status === card.status) ?? card.posts[0])?.text.trim() ?? "";
  const channels = card.posts
    .map((p) => channelsById.get(p.channel_id))
    .filter((c): c is SocialChannel => !!c)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      data-testid={`social-card-${card.group.id}`}
      onClick={() => onOpen(card.group.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(card.group.id);
        }
      }}
      className={cn(
        "rounded border bg-card px-2 py-1 text-xs shadow-sm hover:bg-accent/50 space-y-1",
        published ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_CLASSES[card.status])}
          role="img"
          aria-label={DISPLAY_STATUS_LABELS[card.status]}
          title={DISPLAY_STATUS_LABELS[card.status]}
        />
        {card.scheduledAt && <span className="font-medium tabular-nums">{utcIsoToParisLocal(card.scheduledAt).time}</span>}
        <div className="flex flex-wrap gap-0.5">
          {channels.map((c) => (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="px-1 py-0 text-[10px] leading-4">{c.abbreviation}</Badge>
              </TooltipTrigger>
              <TooltipContent>{c.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <p className="truncate text-muted-foreground">{text || "Sans texte"}</p>
    </div>
  );
}
