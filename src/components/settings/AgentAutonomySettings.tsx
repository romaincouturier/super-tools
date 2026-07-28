import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Bot, History, Play, RotateCcw, ShieldCheck, Search, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DOMAIN_LABELS,
  LEVEL_LABELS,
  useAgentAutonomy,
  type AgentFinding,
  type AutonomyLevel,
} from "@/hooks/useAgentAutonomy";

const LEVEL_VARIANT: Record<AutonomyLevel, "default" | "secondary" | "outline"> = {
  auto: "default",
  notify: "secondary",
  confirm: "outline",
};

function formatDate(value: string | null) {
  if (!value) return "jamais";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lien vers l'entité concernée par un constat, quand elle en a un. */
function findingLink(finding: AgentFinding): string | null {
  if (finding.card_id) return `/crm/card/${finding.card_id}`;
  if (finding.mission_id) return `/missions/${finding.mission_id}`;
  if (finding.transcript_id) return `/transcripts`;
  return null;
}

function FindingRow({ finding }: { finding: AgentFinding }) {
  const to = findingLink(finding);
  const label = (finding.title as string) || (finding.gap as string) || "Constat";
  return (
    <li className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {finding.gap}
          {finding.client ? ` — ${finding.client}` : ""}
          {finding.status ? ` — ${finding.status}` : ""}
          {typeof finding.value === "number" ? ` — ${finding.value} €` : ""}
        </p>
        {finding.next && <p className="text-xs text-muted-foreground">À faire : {finding.next}</p>}
      </div>
      {to && (
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to={to}>
            Ouvrir
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </li>
  );
}

export default function AgentAutonomySettings() {
  const {
    objectives,
    actions,
    policy,
    reports,
    loading,
    running,
    setObjectiveState,
    setPolicyLevel,
    runObjective,
    clearReport,
    revert,
  } = useAgentAutonomy();


  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Objectifs de l'agent
          </CardTitle>
          <CardDescription>
            Un objectif survit aux conversations : l'agent le reprend tant qu'il n'est pas
            atteint. Utilisez « Constater » pour voir ce qu'il ferait sans qu'il écrive quoi
            que ce soit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {objectives.map((objective) => (
            <div
              key={objective.id}
              className="flex w-full flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{DOMAIN_LABELS[objective.domain] ?? objective.domain}</Badge>
                  <span className="font-medium">{objective.title}</span>
                  {objective.state === "met" && <Badge variant="secondary">Atteint</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{objective.criterion}</p>
                <p className="text-xs text-muted-foreground">
                  {objective.run_count} passage(s), dernier {formatDate(objective.last_run_at)}
                  {objective.last_result ? ` — ${objective.last_result}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={running === objective.id}
                  onClick={() => runObjective(objective.id, true)}
                >
                  <Search className="mr-1 h-4 w-4" />
                  Constater
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={running === objective.id}
                  onClick={() => runObjective(objective.id, false)}
                >
                  {running === objective.id ? <Spinner /> : <Play className="mr-1 h-4 w-4" />}
                  Exécuter
                </Button>
                <Switch
                  checked={objective.state === "active"}
                  onCheckedChange={(on) => setObjectiveState(objective.id, on ? "active" : "paused")}
                  aria-label="Objectif actif"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Politique d'autonomie
          </CardTitle>
          <CardDescription>
            Ce que l'agent a le droit de faire sans demander. Réglage de départ : autonomie
            totale sur ce qui reste interne à SuperTools, confirmation dès qu'un tiers reçoit
            quelque chose ou qu'un montant change. Le serveur applique ces niveaux, y compris
            dans le chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {policy.map((entry) => (
            <div
              key={entry.action}
              className="flex w-full flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <code className="text-sm">{entry.action}</code>
                {entry.reason && (
                  <p className="text-xs text-muted-foreground">{entry.reason}</p>
                )}
              </div>
              <Select
                value={entry.level}
                onValueChange={(v) => setPolicyLevel(entry.action, v as AutonomyLevel)}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEVEL_LABELS) as AutonomyLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Ce que l'agent a fait
          </CardTitle>
          <CardDescription>
            Journal des actions autonomes, les 50 dernières. Une action qui a modifié une
            ligne existante est annulable : son état antérieur est conservé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune action autonome pour l'instant.
            </p>
          ) : (
            <div className="space-y-2">
              {actions.map((entry) => (
                <div
                  key={entry.id}
                  className="flex w-full flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm">{entry.action}</code>
                      <Badge variant={LEVEL_VARIANT[entry.autonomy_level]}>
                        {LEVEL_LABELS[entry.autonomy_level]}
                      </Badge>
                      {!entry.succeeded && <Badge variant="destructive">Échec</Badge>}
                      {entry.reverted_at && <Badge variant="outline">Annulée</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.created_at)}
                      {entry.rationale ? ` — ${entry.rationale}` : ""}
                      {entry.error_message ? ` — ${entry.error_message}` : ""}
                    </p>
                  </div>
                  {entry.before_state && !entry.reverted_at && entry.succeeded && (
                    <Button variant="outline" size="sm" onClick={() => revert(entry.id)}>
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Annuler
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
