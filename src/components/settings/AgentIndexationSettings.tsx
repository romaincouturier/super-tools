import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle2, AlertCircle, Database, TriangleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const SOURCE_TYPES = [
  { key: "crm_card", label: "Cartes CRM", description: "Titres, descriptions, notes" },
  { key: "crm_comment", label: "Commentaires CRM", description: "Commentaires sur les cartes" },
  { key: "crm_email", label: "Emails CRM", description: "Emails envoyés depuis le CRM" },
  { key: "inbound_email", label: "Emails reçus", description: "Emails entrants" },
  { key: "training", label: "Formations", description: "Noms, clients, lieux" },
  { key: "mission", label: "Missions", description: "Titres, descriptions, clients" },
  { key: "mission_page", label: "Pages mission", description: "Documentation des missions" },
  { key: "mission_activity", label: "Activités mission", description: "Descriptions des activités facturables" },
  { key: "quote", label: "Devis", description: "Synthèses, instructions, emails" },
  { key: "support_ticket", label: "Tickets support", description: "Titres, descriptions, résolutions" },
  { key: "coaching_summary", label: "Résumés coaching", description: "Notes de coaching" },
  { key: "evaluation_analysis", label: "Analyses évaluations", description: "Synthèses, points forts/faibles, recommandations" },
  { key: "questionnaire_besoins", label: "Questionnaires besoins", description: "Compétences, expériences, accessibilité" },
  { key: "okr_objective", label: "Objectifs OKR", description: "Titres, descriptions, progression" },
  { key: "okr_key_result", label: "Résultats clés OKR", description: "KR et progression" },
  { key: "okr_initiative", label: "Initiatives OKR", description: "Actions et statuts" },
  { key: "content_card", label: "Contenu éditorial", description: "Cartes de contenu" },
  { key: "lms_lesson", label: "Leçons e-learning", description: "Cours, transcripts" },
  { key: "activity_log", label: "Micro-devis", description: "Historique des devis envoyés" },
  { key: "crm_attachment", label: "Pièces jointes CRM", description: "PDF, documents, images des cartes CRM" },
  { key: "support_attachment", label: "Pièces jointes Support", description: "Fichiers joints aux tickets support" },
];

type BackfillStatus = "idle" | "running" | "done" | "error";

export default function AgentIndexationSettings() {
  const [statuses, setStatuses] = useState<Record<string, BackfillStatus>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [stuckCount, setStuckCount] = useState<number | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);

  // Check for stuck queue items (pending > 5 min = pg_net likely not working)
  useEffect(() => {
    const checkQueueHealth = async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("indexation_queue")
        .select("*", { count: "exact", head: true })
        .is("processed_at", null)
        .lt("created_at", fiveMinAgo);

      if (!error) setStuckCount(count ?? 0);
    };
    checkQueueHealth();
  }, [statuses]); // re-check after backfills

  const processQueue = async () => {
    setProcessingQueue(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Non authentifié");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-indexation-queue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Queue traitée : ${data.processed} éléments indexés`);
      setStuckCount(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de traitement");
    } finally {
      setProcessingQueue(false);
    }
  };

  const runBackfill = async (sourceType: string) => {
    setStatuses((prev) => ({ ...prev, [sourceType]: "running" }));
    setResults((prev) => ({ ...prev, [sourceType]: "" }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Non authentifié");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/index-documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ source_type: sourceType, backfill: true }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Erreur ${res.status}`);
      }

      const data = await res.json();
      setStatuses((prev) => ({ ...prev, [sourceType]: "done" }));
      setResults((prev) => ({
        ...prev,
        [sourceType]: `${data.chunks_indexed} chunks indexés (${data.documents_found} docs)`,
      }));
    } catch (err) {
      setStatuses((prev) => ({ ...prev, [sourceType]: "error" }));
      setResults((prev) => ({
        ...prev,
        [sourceType]: err instanceof Error ? err.message : "Erreur",
      }));
    }
  };

  const runAllBackfill = async () => {
    setRunningAll(true);
    for (const source of SOURCE_TYPES) {
      await runBackfill(source.key);
    }
    setRunningAll(false);
    toast.success("Backfill terminé pour toutes les sources");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Indexation Agent IA
        </CardTitle>
        <CardDescription>
          Indexez vos contenus existants pour que l'agent puisse les rechercher.
          L'indexation continue est automatique via les triggers de base de données.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stuckCount !== null && stuckCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
            <TriangleAlert className="h-5 w-5 shrink-0" />
            <div className="flex-1 text-sm">
              <strong>{stuckCount} élément{stuckCount > 1 ? "s" : ""}</strong> en attente depuis plus de 5 min.
              L'indexation automatique ne fonctionne peut-être pas (pg_net indisponible).
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={processQueue}
              disabled={processingQueue}
              className="shrink-0 gap-1.5"
            >
              {processingQueue ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Traiter maintenant
            </Button>
          </div>
        )}

        <Button onClick={runAllBackfill} disabled={runningAll} className="gap-2">
          {runningAll ? <Spinner /> : <Play className="h-4 w-4" />}
          Tout indexer
        </Button>

        <div className="grid gap-2">
          {SOURCE_TYPES.map((source) => {
            const status = statuses[source.key] || "idle";
            const result = results[source.key];

            return (
              <div
                key={source.key}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{source.label}</span>
                    {status === "done" && (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" /> OK
                      </Badge>
                    )}
                    {status === "error" && (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <AlertCircle className="h-3 w-3" /> Erreur
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result || source.description}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBackfill(source.key)}
                  disabled={status === "running" || runningAll}
                >
                  {status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
