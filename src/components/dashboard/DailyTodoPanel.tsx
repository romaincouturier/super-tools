import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Clock,
} from "lucide-react";

// ── Category config ──

interface CategoryConfig {
  label: string;
  emoji: string;
  color: string;
}

// Display order for categories (matches daily digest email order)
const CATEGORY_ORDER = [
  "formations_facture",
  "missions_a_facturer",
  "devis_a_faire",
  "devis_a_relancer",
  "opportunites",
  "articles_relire",
  "cfp_soumettre",
  "formations_conventions",
  "evenements",
  "cfp_surveiller",
];

const CATEGORIES: Record<string, CategoryConfig> = {
  formations_facture: { label: "Factures à émettre", emoji: "🧾", color: "text-red-600" },
  missions_a_facturer: { label: "Factures missions", emoji: "💰", color: "text-green-600" },
  devis_a_faire: { label: "Devis à faire", emoji: "📝", color: "text-blue-600" },
  devis_a_relancer: { label: "Devis à relancer", emoji: "🔄", color: "text-orange-600" },
  opportunites: { label: "Opportunités à contacter", emoji: "🎯", color: "text-amber-600" },
  articles_relire: { label: "Articles à relire", emoji: "📋", color: "text-purple-600" },
  cfp_soumettre: { label: "CFP à soumettre", emoji: "📨", color: "text-orange-600" },
  formations_conventions: { label: "Formations", emoji: "🎓", color: "text-red-600" },
  evenements: { label: "Événements", emoji: "📅", color: "text-teal-600" },
  cfp_surveiller: { label: "CFP à surveiller", emoji: "🔁", color: "text-blue-600" },
};

// ── Types ──

interface DailyAction {
  id: string;
  category: string;
  title: string;
  description: string | null;
  link: string | null;
  is_completed: boolean;
  completed_at: string | null;
  auto_completed: boolean;
}

interface CategoryAnalytics {
  label: string;
  avg_completion_minutes: number | null;
  total: number;
  completed: number;
}

interface DailyAnalytics {
  total_actions: number;
  completed_count: number;
  category_stats: Record<string, CategoryAnalytics>;
}

// ── Component ──

const DailyTodoPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [actions, setActions] = useState<DailyAction[]>([]);
  const [analytics, setAnalytics] = useState<DailyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showAnalytics, setShowAnalytics] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const fetchActions = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("daily_actions")
      .select("id, category, title, description, link, is_completed, completed_at, auto_completed")
      .eq("user_id", user.id)
      .eq("action_date", today)
      .order("category")
      .order("is_completed")
      .order("title");

    if (!error && data) {
      setActions(data);
    }
  }, [user, today]);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    // Fetch last 30 days of analytics for theme ranking
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

    const { data } = await supabase
      .from("daily_action_analytics")
      .select("category_stats, total_actions, completed_count")
      .eq("user_id", user.id)
      .gte("action_date", fromDate)
      .order("action_date", { ascending: false });

    if (data && data.length > 0) {
      // Aggregate category stats across days
      const aggregated: Record<string, { totalMinutes: number; count: number; totalActions: number; totalCompleted: number }> = {};

      for (const day of data) {
        const stats = day.category_stats as unknown as Record<string, CategoryAnalytics> | null;
        if (!stats) continue;
        for (const [cat, catStats] of Object.entries(stats)) {
          if (!aggregated[cat]) aggregated[cat] = { totalMinutes: 0, count: 0, totalActions: 0, totalCompleted: 0 };
          aggregated[cat].totalActions += catStats.total || 0;
          aggregated[cat].totalCompleted += catStats.completed || 0;
          if (catStats.avg_completion_minutes !== null && catStats.avg_completion_minutes >= 0) {
            aggregated[cat].totalMinutes += catStats.avg_completion_minutes;
            aggregated[cat].count++;
          }
        }
      }

      const categoryStats: Record<string, CategoryAnalytics> = {};
      for (const [cat, agg] of Object.entries(aggregated)) {
        categoryStats[cat] = {
          label: CATEGORIES[cat]?.label || cat,
          avg_completion_minutes: agg.count > 0 ? Math.round(agg.totalMinutes / agg.count) : null,
          total: agg.totalActions,
          completed: agg.totalCompleted,
        };
      }

      const totalActions = data.reduce((sum, d) => sum + (d.total_actions || 0), 0);
      const completedCount = data.reduce((sum, d) => sum + (d.completed_count || 0), 0);

      setAnalytics({ total_actions: totalActions, completed_count: completedCount, category_stats: categoryStats });
    }
  }, [user]);

  const autoDetect = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await supabase.functions.invoke("check-daily-actions-completion");
      await fetchActions();
    } finally {
      setRefreshing(false);
    }
  }, [user, fetchActions]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchActions();
      await fetchAnalytics();
      setLoading(false);
      // Auto-detect on first load
      autoDetect();
    };
    load();
  }, [fetchActions, fetchAnalytics, autoDetect]);

  const toggleAction = async (actionId: string, completed: boolean) => {
    // Optimistic update
    setActions((prev) =>
      prev.map((a) =>
        a.id === actionId
          ? { ...a, is_completed: completed, completed_at: completed ? new Date().toISOString() : null, auto_completed: false }
          : a
      )
    );

    const { error } = await supabase
      .from("daily_actions")
      .update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
        auto_completed: false,
      } as any)
      .eq("id", actionId);

    if (error) {
      // Revert on error
      await fetchActions();
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Group actions by category, respecting display order
  const groupedMap = actions.reduce<Record<string, DailyAction[]>>((acc, action) => {
    (acc[action.category] = acc[action.category] || []).push(action);
    return acc;
  }, {});

  // Sort categories according to CATEGORY_ORDER
  const grouped = Object.fromEntries(
    [...CATEGORY_ORDER, ...Object.keys(groupedMap).filter((k) => !CATEGORY_ORDER.includes(k))]
      .filter((k) => groupedMap[k])
      .map((k) => [k, groupedMap[k]])
  );

  const totalCount = actions.length;
  const completedCount = actions.filter((a) => a.is_completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Theme ranking: sorted by avg completion time (fastest first)
  const themeRanking = analytics
    ? Object.entries(analytics.category_stats)
        .filter(([, s]) => s.avg_completion_minutes !== null)
        .sort((a, b) => (a[1].avg_completion_minutes ?? 999) - (b[1].avg_completion_minutes ?? 999))
    : [];

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
        <p className="text-sm text-muted-foreground">Aucune action pour aujourd'hui</p>
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
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={autoDetect}
                disabled={refreshing}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Vérifier les actions résolues</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Progress bar */}
      <div className="space-y-1 shrink-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{completedCount}/{totalCount} actions</span>
          <span>{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Actions list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 pr-2">
          {Object.entries(grouped).map(([category, catActions]) => {
            const config = CATEGORIES[category] || { label: category, emoji: "📌", color: "text-gray-600" };
            const catCompleted = catActions.filter((a) => a.is_completed).length;
            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category}>
                {/* Category header */}
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

                {/* Action items */}
                {!isCollapsed && (
                  <div className="ml-5 mt-1 space-y-1">
                    {catActions.map((action) => (
                      <div
                        key={action.id}
                        className={`flex items-start gap-2 py-1.5 px-2 rounded-md transition-colors ${
                          action.is_completed ? "opacity-60" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={action.is_completed}
                          onCheckedChange={(checked) => toggleAction(action.id, checked === true)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-tight ${action.is_completed ? "line-through text-muted-foreground" : ""}`}>
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                const url = new URL(action.link!, window.location.origin);
                                navigate(url.pathname);
                              } catch {
                                navigate(action.link!);
                              }
                            }}
                            className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Analytics toggle */}
      {themeRanking.length > 0 && (
        <div className="border-t pt-3 shrink-0">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
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
                const config = CATEGORIES[cat] || { label: cat, emoji: "📌", color: "text-gray-600" };
                const minutes = stats.avg_completion_minutes ?? 0;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const timeLabel = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ""}` : `${mins}m`;
                const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

                return (
                  <div key={cat} className="flex items-center gap-2 text-sm py-1 px-2 rounded-md hover:bg-muted/50">
                    <span className="text-xs font-mono text-muted-foreground w-4">#{index + 1}</span>
                    <span>{config.emoji}</span>
                    <span className="flex-1 truncate">{config.label}</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{timeLabel}</span>
                    </div>
                    <Badge variant={completionRate >= 80 ? "default" : "secondary"} className="text-[10px]">
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
      )}
    </div>
  );
};

export default DailyTodoPanel;
