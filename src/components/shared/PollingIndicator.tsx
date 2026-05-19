import { useState } from "react";
import { Clock, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { supabase } from "@/integrations/supabase/client";
import {
  usePollingCursor,
  getNextHourlyRun,
  formatNextRun,
} from "@/hooks/usePollingCursor";

interface PollingIndicatorProps {
  source: string;
  label?: string;
  /** Edge function name to invoke when forcing the polling. */
  functionName?: string;
  /** Custom label for the force button. */
  forceLabel?: string;
}

export function PollingIndicator({ source, label = "Polling", functionName, forceLabel }: PollingIndicatorProps) {
  const { data: cursor, isLoading } = usePollingCursor(source);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

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

  const handleForce = async () => {
    if (!functionName) return;
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
      if (error) throw error;
      const summary = data
        ? data.error || data.warning || `Soumis : ${data.submitted ?? 0} · Complétés : ${data.completed ?? data.imported ?? 0} · Erreurs : ${data.errors ?? 0}`
        : "Polling exécuté";
      toast({ title: "Polling déclenché", description: summary });
      await qc.invalidateQueries({ queryKey: ["polling-cursor", source] });
      await qc.invalidateQueries({ queryKey: ["transcripts"] });
      await qc.invalidateQueries({ queryKey: ["testimonials"] });
    } catch (err) {
      let message = err instanceof Error ? err.message : "Échec du polling";
      const response = (err as { context?: Response })?.context;
      if (response) {
        const payload = await response.clone().json().catch(() => null);
        message = payload?.error || payload?.warning || message;
      }
      await qc.invalidateQueries({ queryKey: ["polling-cursor", source] });
      toastError(toast, message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
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
      {functionName && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleForce}
          disabled={isRunning}
          title="Forcer le polling maintenant"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {forceLabel ?? "Forcer"}
        </Button>
      )}
    </div>
  );
}
