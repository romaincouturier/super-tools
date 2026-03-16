import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

interface CronRun {
  status: string;
  start_time: string;
  end_time: string | null;
  return_message: string | null;
}

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  last_run: CronRun | null;
  recent_runs: CronRun[];
}

function formatDuration(startTime: string, endTime: string | null): string {
  if (!endTime) return "en cours...";
  const seconds = differenceInSeconds(parseISO(endTime), parseISO(startTime));
  if (seconds < 1) return "< 1s";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusBadge(status: string) {
  switch (status) {
    case "succeeded":
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          OK
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <XCircle className="h-3 w-3" />
          Erreur
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          En cours
        </Badge>
      );
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
}

const CronJobsTab = () => {
  const [expandedJob, setExpandedJob] = useState<number | null>(null);

  const { data: cronData, isLoading } = useQuery({
    queryKey: ["cron-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cron_status");
      if (error) throw error;
      return data as unknown as { jobs: CronJob[] };
    },
    refetchInterval: 30000,
  });

  const jobs = cronData?.jobs || [];
  const succeededCount = jobs.filter((j) => j.last_run?.status === "succeeded").length;
  const failedCount = jobs.filter((j) => j.last_run?.status === "failed").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        Chargement des cron jobs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jobs planifiés</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dernière exécution OK</p>
                <p className="text-2xl font-bold">{succeededCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En erreur</p>
                <p className="text-2xl font-bold">{failedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs table */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun cron job configuré.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Détail des jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead>Dernière exécution</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <Collapsible
                    key={job.jobid}
                    open={expandedJob === job.jobid}
                    onOpenChange={(open) => setExpandedJob(open ? job.jobid : null)}
                    asChild
                  >
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            {expandedJob === job.jobid ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{job.jobname}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {job.schedule}
                            </code>
                          </TableCell>
                          <TableCell>
                            {job.last_run ? statusBadge(job.last_run.status) : (
                              <Badge variant="outline" className="text-xs">Jamais exécuté</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {job.active ? (
                              <Play className="h-4 w-4 text-green-600" />
                            ) : (
                              <Pause className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {job.last_run?.start_time
                              ? format(parseISO(job.last_run.start_time), "d MMM HH:mm", { locale: fr })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {job.last_run
                              ? formatDuration(job.last_run.start_time, job.last_run.end_time)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Commande</p>
                                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{job.command}</pre>
                              </div>
                              {job.recent_runs.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Dernières exécutions
                                  </p>
                                  <div className="flex gap-1">
                                    {job.recent_runs.map((run, i) => (
                                      <div
                                        key={i}
                                        className={`h-6 w-6 rounded-sm flex items-center justify-center text-[10px] font-medium ${
                                          run.status === "succeeded"
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                                            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                        }`}
                                        title={`${run.status} - ${run.start_time ? format(parseISO(run.start_time), "d/MM HH:mm", { locale: fr }) : ""}`}
                                      >
                                        {run.status === "succeeded" ? "✓" : "✗"}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {job.last_run?.return_message && job.last_run.status === "failed" && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Message d'erreur</p>
                                  <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-x-auto">
                                    {job.last_run.return_message}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CronJobsTab;
