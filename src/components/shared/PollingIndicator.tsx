import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  usePollingCursor,
  getNextHourlyRun,
  formatNextRun,
} from "@/hooks/usePollingCursor";

interface PollingIndicatorProps {
  source: string;
  label?: string;
}

export function PollingIndicator({ source, label = "Polling" }: PollingIndicatorProps) {
  const { data: cursor, isLoading } = usePollingCursor(source);

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Chargement…
      </Badge>
    );
  }

  const nextRun = getNextHourlyRun();
  const nextRunLabel = formatNextRun(nextRun);

  const statusIcon =
    cursor?.status === "error" ? (
      <AlertCircle className="h-3 w-3 text-destructive" />
    ) : cursor?.status === "running" ? (
      <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
    ) : (
      <CheckCircle2 className="h-3 w-3 text-green-600" />
    );

  const statusText =
    cursor?.status === "error"
      ? "Erreur"
      : cursor?.status === "running"
      ? "En cours"
      : "OK";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={cursor?.status === "error" ? "destructive" : "outline"}
            className="gap-1 text-xs cursor-help"
          >
            <Clock className="h-3 w-3" />
            Prochain à {nextRunLabel}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="space-y-1">
          <p className="font-medium">{label}</p>
          <div className="flex items-center gap-1.5 text-xs">
            {statusIcon}
            <span>Statut : {statusText}</span>
          </div>
          {cursor?.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Dernier sync :{" "}
              {new Date(cursor.last_synced_at).toLocaleString("fr-FR")}
            </p>
          )}
          {cursor?.last_error && (
            <p className="text-xs text-destructive">{cursor.last_error}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
