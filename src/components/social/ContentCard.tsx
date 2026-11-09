import { useDraggable } from "@dnd-kit/core";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatAlert } from "../../../supabase/functions/_shared/social-post-alerts";
import {
  DISPLAY_STATUS_LABELS,
  utcIsoToParisLocal,
  type CalendarCard,
  type ChannelAlerts,
  type SocialChannel,
  type SocialPublicationStatus,
  type SocialTheme,
} from "@/services/socialContents";

export const STATUS_DOT_CLASSES: Record<SocialPublicationStatus, string> = {
  unscheduled: "bg-muted-foreground/60",
  scheduled: "bg-blue-500",
  published: "bg-green-600",
};

interface ContentCardProps {
  card: CalendarCard;
  channelsById: Map<string, SocialChannel>;
  /** Thèmes connus : le liseré gauche prend la couleur du thème du contenu, neutre sinon. */
  themesById?: ReadonlyMap<string, SocialTheme>;
  onOpen: (groupId: string) => void;
}

/** Indicateur d'alerte avec le détail par canal en infobulle (carte et composeur). */
export function AlertIndicator({ alerts, channelsById }: { alerts: ChannelAlerts[]; channelsById: Map<string, SocialChannel> }) {
  if (alerts.length === 0) return null;
  const count = alerts.reduce((n, a) => n + a.alerts.length, 0);
  const lines = alerts.map((a) => `${channelsById.get(a.channelId)?.name ?? "Canal"} : ${a.alerts.map(formatAlert).join(", ")}`);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          tabIndex={0}
          aria-label={`${count} alerte${count > 1 ? "s" : ""} : ${lines.join(" ; ")}`}
          data-testid="social-alert-indicator"
          className="inline-flex shrink-0 text-amber-600"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="space-y-0.5 text-xs">
          {lines.map((line, i) => <li key={alerts[i].channelId}>{line}</li>)}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ContentCard({ card, channelsById, themesById, onOpen }: ContentCardProps) {
  const { isDemoMode } = useDemoMode();
  const theme = card.group.theme_id ? themesById?.get(card.group.theme_id) : undefined;
  // Même règle que le dépôt sur la page : toutes les déclinaisons du contenu, filtrées ou non.
  const published = card.group.posts.length > 0 && card.group.posts.every((p) => p.publication_status === "published");
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
      data-theme={theme?.id}
      style={theme ? { borderLeftColor: theme.color } : undefined}
      onClick={() => onOpen(card.group.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(card.group.id);
        }
      }}
      className={cn(
        "rounded border border-l-4 bg-card px-2 py-1 text-xs shadow-sm hover:bg-accent/50 space-y-1",
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
        <span className="ml-auto" />
        <AlertIndicator alerts={card.alerts} channelsById={channelsById} />
      </div>
      <p className="truncate text-muted-foreground">{text ? (isDemoMode ? maskText(text) : text) : "Sans texte"}</p>
    </div>
  );
}
