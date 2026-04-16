import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDailyActions } from "@/hooks/useDailyActions";
import { useDailyAnalytics } from "@/hooks/useDailyAnalytics";
import {
  CATEGORY_ORDER,
  getCategoryConfig,
  type DailyAction,
} from "@/lib/dailyActionConstants";
import type { ThemeRankingEntry } from "@/hooks/useDailyAnalytics";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import ReactMarkdown from "react-markdown";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Clock,
  CalendarClock,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// ── Helpers ──

function groupActionsByCategory(
  actions: DailyAction[]
): Record<string, DailyAction[]> {
  const groupedMap = actions.reduce<Record<string, DailyAction[]>>(
    (acc, action) => {
      (acc[action.category] = acc[action.category] || []).push(action);
      return acc;
    },
    {}
  );

  // Sort categories according to CATEGORY_ORDER
  return Object.fromEntries(
    [
      ...CATEGORY_ORDER,
      ...Object.keys(groupedMap).filter(
        (k) => !(CATEGORY_ORDER as readonly string[]).includes(k)
      ),
    ]
      .filter((k) => groupedMap[k])
      .map((k) => [k, groupedMap[k]])
  );
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0
    ? `${hours}h${mins > 0 ? `${mins}m` : ""}`
    : `${mins}m`;
}

// ── Component ──

const DailyTodoPanel = () => {
  const navigate = useNavigate();
  const {
    actions,
    loading,
    refreshing,
    totalCount,
    completedCount,
    progressPercent,
    toggleAction,
    autoDetect,
  } = useDailyActions();
  const { themeRanking } = useDailyAnalytics();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [agendaContent, setAgendaContent] = useState<string | null>(null);
  const { loading: agendaLoading, invoke: invokeAgenda } = useEdgeFunction<{ agenda?: string }>(
    "generate-daily-agenda",
    { silentOnError: true },
  );

  const generateAgenda = useCallback(async () => {
    const pending = actions.filter((a) => !a.is_completed);
    if (pending.length === 0) return;
    setShowAgenda(true);
    const data = await invokeAgenda({
      actions: pending.map((a) => ({
        category: getCategoryConfig(a.category).label,
        title: a.title,
        description: a.description,
      })),
    });
    if (data) {
      setAgendaContent(data.agenda || "Impossible de générer l'agenda.");
    } else {
      setAgendaContent("Erreur lors de la génération de l'agenda.");
    }
  }, [actions, invokeAgenda]);

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const handleNavigate = useCallback((link: string) => {
    if (link.startsWith("http")) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      try {
        const url = new URL(link, window.location.origin);
        navigate(url.pathname);
      } catch {
        navigate(link);
      }
    }
  }, [navigate]);

  const grouped = groupActionsByCategory(actions);

  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Aucune action pour aujourd'hui
        </p>
        <button
          onClick={autoDetect}
          className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Rafraîchir
        </button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">TODO du jour</h2>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={generateAgenda}
                  disabled={agendaLoading}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  {agendaLoading
                    ? <Spinner className="text-muted-foreground" />
                    : <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </TooltipTrigger>
              <TooltipContent>Proposer un agenda priorisé</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={autoDetect}
                  disabled={refreshing}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <RefreshCw
                    className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>Vérifier les actions résolues</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1 shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completedCount}/{totalCount} actions
          </span>
          <span>{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Actions list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-3 pr-2">
          {/* AI Agenda */}
          {showAgenda && (
            <div className="border rounded-lg bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Agenda proposé
                </span>
                <button
                  onClick={() => setShowAgenda(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Fermer
                </button>
              </div>
              {agendaLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner className="text-primary" />
                </div>
              ) : agendaContent ? (
                <div className="text-xs leading-relaxed prose prose-xs max-w-none [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs [&_strong]:text-foreground">
                  <ReactMarkdown>{agendaContent}</ReactMarkdown>
                </div>
              ) : null}
            </div>
          )}
          {Object.entries(grouped).map(([category, catActions]) => {
            const config = getCategoryConfig(category);
            const catCompleted = catActions.filter(
              (a) => a.is_completed
            ).length;
            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="flex items-center gap-2 w-full text-left py-1 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm">{config.emoji}</span>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {config.label}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {catCompleted}/{catActions.length}
                  </Badge>
                </button>

                {!isCollapsed && (
                  <div className="ml-5 mt-1 space-y-1">
                    {catActions.map((action) => (
                      <div
                        key={action.id}
                        className={`flex items-start gap-2 py-1.5 px-2 rounded-md transition-colors ${
                          action.is_completed
                            ? "opacity-60"
                            : "hover:bg-muted/50"
                        } ${action.link ? "cursor-pointer" : ""}`}
                        onClick={
                          action.link
                            ? () => handleNavigate(action.link!)
                            : undefined
                        }
                      >
                        <Checkbox
                          checked={action.is_completed}
                          onCheckedChange={(checked) =>
                            toggleAction(action.id, checked === true)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm leading-tight ${action.is_completed ? "line-through text-muted-foreground" : ""} ${action.link && !action.is_completed ? "text-primary hover:underline" : ""}`}
                          >
                            {action.title}
                          </p>
                          {action.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {action.description}
                            </p>
                          )}
                          {action.auto_completed && action.is_completed && (
                            <span className="text-[10px] text-green-600 font-medium">
                              Auto-détecté
                            </span>
                          )}
                        </div>
                        {action.link && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Analytics toggle */}
      {themeRanking.length > 0 && (
        <AnalyticsSection
          themeRanking={themeRanking}
          showAnalytics={showAnalytics}
          onToggle={() => setShowAnalytics(!showAnalytics)}
        />
      )}
    </div>
  );
};

// ── Analytics sub-component ──

interface AnalyticsSectionProps {
  themeRanking: ThemeRankingEntry[];
  showAnalytics: boolean;
  onToggle: () => void;
}

function AnalyticsSection({
  themeRanking,
  showAnalytics,
  onToggle,
}: AnalyticsSectionProps) {
  return (
    <div className="border-t pt-3 shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <TrendingUp className="h-4 w-4" />
        Classement des thèmes
        {showAnalytics ? (
          <ChevronDown className="h-3.5 w-3.5 ml-auto" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 ml-auto" />
        )}
      </button>

      {showAnalytics && (
        <div className="mt-2 space-y-1.5">
          {themeRanking.map(([cat, stats], index) => {
            const config = getCategoryConfig(cat);
            const minutes = stats.avg_completion_minutes ?? 0;
            const timeLabel = formatTime(minutes);
            const completionRate =
              stats.total > 0
                ? Math.round((stats.completed / stats.total) * 100)
                : 0;

            return (
              <div
                key={cat}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded-md hover:bg-muted/50"
              >
                <span className="text-xs font-mono text-muted-foreground w-4">
                  #{index + 1}
                </span>
                <span>{config.emoji}</span>
                <span className="flex-1 truncate">{config.label}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{timeLabel}</span>
                </div>
                <Badge
                  variant={completionRate >= 80 ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {completionRate}%
                </Badge>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Temps moyen de résolution (30 derniers jours)
          </p>
        </div>
      )}
    </div>
  );
}

export default DailyTodoPanel;
