import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMySupportTickets } from "@/hooks/useSupport";
import {
  TICKET_PRIORITY_CONFIG,
  TICKET_TYPE_CONFIG,
  SUPPORT_COLUMNS,
  type SupportTicket,
} from "@/types/support";

const STATUS_LABEL: Record<string, string> = SUPPORT_COLUMNS.reduce((acc, col) => {
  acc[col.id] = col.name;
  return acc;
}, {} as Record<string, string>);

const STATUS_CLASSES: Record<string, string> = {
  nouveau: "bg-muted text-foreground border-border",
  en_cours: "bg-info-surface text-info-ink border-info-line",
  en_attente: "bg-caution-surface text-caution-ink border-caution-line",
  resolu: "bg-success-surface text-success border-success-line",
  ferme: "bg-muted text-muted-foreground border-border",
};

function formatRelative(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ChatbotMyTicketsTab() {
  const { data: tickets = [], isLoading, error } = useMySupportTickets();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <Spinner className="mr-2" /> Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Impossible de charger vos tickets.
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3 text-muted-foreground">
        <Inbox className="h-8 w-8 opacity-40" />
        <div>
          <p className="font-semibold text-foreground">Aucun ticket signalé</p>
          <p className="text-xs mt-1">Les bugs et évolutions que vous soumettez apparaîtront ici.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <ul className="p-3 space-y-2">
        {tickets.map((t) => (
          <TicketRow key={t.id} ticket={t} />
        ))}
      </ul>
    </ScrollArea>
  );
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const typeMeta = TICKET_TYPE_CONFIG[ticket.type];
  const prioMeta = TICKET_PRIORITY_CONFIG[ticket.priority];
  const statusLabel = STATUS_LABEL[ticket.status] || ticket.status;
  return (
    <li className="rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-mono">{ticket.ticket_number}</p>
          <p className="font-medium text-sm truncate">{ticket.title}</p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-micro font-medium",
            STATUS_CLASSES[ticket.status] || STATUS_CLASSES.nouveau,
          )}
        >
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 text-caption text-muted-foreground">
        <div className="flex items-center gap-2">
          <span style={{ color: typeMeta.color }}>{typeMeta.label}</span>
          <span>·</span>
          <span style={{ color: prioMeta.color }}>{prioMeta.label}</span>
        </div>
        <span>{formatRelative(ticket.created_at)}</span>
      </div>
    </li>
  );
}
