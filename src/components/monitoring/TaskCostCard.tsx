import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rpc } from "@/lib/supabase-rpc";
import { summarizeTasks } from "@/lib/taskCost";

/**
 * Coût par tâche aboutie (agents).
 *
 * Le reste de l'onglet agrège par appel. Pour un agent, cette unité ment :
 * une question produit plusieurs appels facturés, et découper davantage fait
 * baisser le coût par appel sans rien économiser. Cette carte regroupe les
 * appels par `metadata.task_id`, c'est-à-dire par tour utilisateur.
 */

interface Props {
  /** Fenêtre en jours, alignée sur le sélecteur de l'onglet. */
  days: number;
  formatUsd: (value: number) => string;
  formatCompact: (value: number) => string;
  /** Ne rien demander tant que l'agrégat principal n'a rien rendu. */
  enabled: boolean;
}

export function TaskCostCard({ days, formatUsd, formatCompact, enabled }: Props) {
  const { data: tasks = [] } = useQuery({
    queryKey: ["api-usage-by-task", days],
    retry: false,
    enabled,
    queryFn: async () => {
      const { data, error } = await rpc.getApiUsageByTask(days, 20);
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);

  if (tasks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          Coût par tâche
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Une tâche est un tour utilisateur complet : la question, les outils
          appelés, la réponse. C'est ce qu'un agent coûte réellement, là où le
          coût par appel baisse dès qu'on découpe davantage.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Moy. / tâche aboutie</p>
            <p className="text-2xl font-bold">{formatUsd(summary.avgCostPerSuccess)}</p>
            <p className="text-xs text-muted-foreground">
              sur {summary.succeeded} tâche{summary.succeeded > 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tâche la plus chère</p>
            <p className="text-2xl font-bold">{formatUsd(summary.maxCost)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Appels / tâche</p>
            <p className="text-2xl font-bold">{summary.avgCalls.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">
              {summary.cacheRate.toFixed(0)} % d'entrée en cache
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dépensé sans aboutir</p>
            <p className="text-2xl font-bold">{formatUsd(summary.wastedCost)}</p>
            {summary.failed > 0 && (
              <p className="text-xs text-destructive">
                {summary.failed} tâche{summary.failed > 1 ? "s" : ""} en erreur
              </p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tâche</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead className="text-right">Appels</TableHead>
                <TableHead className="text-right">Entrée (dont cache)</TableHead>
                <TableHead className="text-right">Sortie</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead className="text-right">Coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.task_id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(parseISO(t.started_at), "d MMM HH:mm", { locale: fr })}
                    {Number(t.errors) > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {t.errors}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">
                      {t.origin}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t.calls}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatCompact(Number(t.input_tokens) + Number(t.cache_read_tokens))}
                    {Number(t.cache_read_tokens) > 0 &&
                      ` (${formatCompact(Number(t.cache_read_tokens))})`}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatCompact(Number(t.output_tokens))}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {(Number(t.duration_ms) / 1000).toFixed(1)} s
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatUsd(Number(t.cost_usd))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default TaskCostCard;
