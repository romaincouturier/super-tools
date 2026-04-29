import { ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CrmCard } from "@/types/crm";

const fmt = (v: number) => v.toLocaleString("fr-FR");

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Ouvert",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELED: "Annulé",
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  CANCELED: "bg-gray-100 text-gray-700",
};

function cardLabel(card: CrmCard): string {
  if (card.title) return card.title;
  const contact = [card.first_name, card.last_name].filter(Boolean).join(" ").trim();
  return contact || card.company || `Opportunité #${card.id.slice(0, 8)}`;
}

export interface PivotCellDetailProps {
  /** Cards that contribute to the displayed value. */
  cards: CrmCard[];
  /** Human-readable description of the cell (e.g. "Source: linkedin × Type: mission"). */
  label: string;
  /** Aggregated value displayed in the cell (€). */
  value: number;
  /** Style override for the trigger (e.g. font-bold for totals). */
  triggerClassName?: string;
}

/**
 * Wraps a pivot-table cell value with a Popover that, on click, lists the CRM
 * cards (opportunités) that contributed to the aggregate. Lets the user verify
 * how a number was computed without exporting the report.
 */
export default function PivotCellDetail({
  cards,
  label,
  value,
  triggerClassName,
}: PivotCellDetailProps) {
  if (cards.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const sortedCards = [...cards].sort(
    (a, b) => (b.estimated_value || 0) - (a.estimated_value || 0),
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "tabular-nums underline-offset-2 hover:underline hover:text-primary transition-colors cursor-pointer",
            triggerClassName,
          )}
          aria-label={`Voir les opportunités — ${label}`}
        >
          {fmt(value)} €
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[90vw] p-0" align="end">
        <div className="px-3 py-2 border-b">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold tabular-nums">
            {fmt(value)} € · {cards.length} opportunité{cards.length > 1 ? "s" : ""}
          </p>
        </div>
        <ul className="max-h-80 overflow-y-auto divide-y">
          {sortedCards.map((card) => {
            const subtitle = [
              [card.first_name, card.last_name].filter(Boolean).join(" ").trim(),
              card.company,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={card.id}>
                <a
                  href={`/crm/card/${card.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{cardLabel(card)}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    {subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-sm font-medium tabular-nums">
                      {fmt(card.estimated_value || 0)} €
                    </span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] border-0", STATUS_CLASS[card.sales_status])}
                    >
                      {STATUS_LABEL[card.sales_status] || card.sales_status}
                    </Badge>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
