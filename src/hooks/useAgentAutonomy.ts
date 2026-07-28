import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

/**
 * Pilotage de l'agent autonome : objectifs, journal des actions, politique.
 *
 * Le journal n'est pas décoratif. Un agent qui agit sans supervision n'est
 * acceptable que si l'on peut relire ce qu'il a fait et le défaire : c'est la
 * contrepartie de l'autonomie, pas une option.
 */

export type AutonomyLevel = "auto" | "notify" | "confirm";

export interface AgentObjective {
  id: string;
  domain: string;
  title: string;
  criterion: string;
  state: "active" | "paused" | "met" | "failed";
  cadence_hours: number;
  last_run_at: string | null;
  last_result: string | null;
  run_count: number;
}

export interface AgentActionEntry {
  id: string;
  domain: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  rationale: string | null;
  autonomy_level: AutonomyLevel;
  succeeded: boolean;
  error_message: string | null;
  reverted_at: string | null;
  created_at: string;
  before_state: unknown;
}

export interface AgentPolicyEntry {
  action: string;
  level: AutonomyLevel;
  reason: string | null;
}

export const DOMAIN_LABELS: Record<string, string> = {
  facilitateur: "Facilitateur",
  contenus: "Contenus et marketing",
  commerce: "Commerce",
  transformation: "Transformation",
};

export const LEVEL_LABELS: Record<AutonomyLevel, string> = {
  auto: "Agit seul",
  notify: "Agit puis signale",
  confirm: "Demande avant",
};

export function useAgentAutonomy() {
  const [objectives, setObjectives] = useState<AgentObjective[]>([]);
  const [actions, setActions] = useState<AgentActionEntry[]>([]);
  const [policy, setPolicy] = useState<AgentPolicyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const orchestrator = useEdgeFunction<Record<string, unknown>>("agent-objectives", {
    errorMessage: "L'orchestrateur d'objectifs n'a pas répondu",
  });

  const load = useCallback(async () => {
    const [obj, log, pol] = await Promise.all([
      supabase
        .from("agent_objectives")
        .select("id, domain, title, criterion, state, cadence_hours, last_run_at, last_result, run_count")
        .order("domain", { ascending: true }),
      supabase
        .from("agent_action_log")
        .select(
          "id, domain, action, target_table, target_id, rationale, autonomy_level, succeeded, error_message, reverted_at, created_at, before_state",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("agent_autonomy_policy")
        .select("action, level, reason")
        .order("level", { ascending: true }),
    ]);

    const firstError = obj.error || log.error || pol.error;
    if (firstError) {
      toast.error("Impossible de charger le pilotage de l'agent", { description: firstError.message });
    }
    setObjectives((obj.data ?? []) as AgentObjective[]);
    setActions((log.data ?? []) as AgentActionEntry[]);
    setPolicy((pol.data ?? []) as AgentPolicyEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setObjectiveState = useCallback(
    async (id: string, state: AgentObjective["state"]) => {
      const { error } = await supabase
        .from("agent_objectives")
        .update({ state, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        toast.error("Changement d'état impossible", { description: error.message });
        return;
      }
      setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, state } : o)));
    },
    [],
  );

  const setPolicyLevel = useCallback(async (action: string, level: AutonomyLevel) => {
    const { error } = await supabase
      .from("agent_autonomy_policy")
      .update({ level, updated_at: new Date().toISOString() })
      .eq("action", action);
    if (error) {
      toast.error("Changement de politique impossible", { description: error.message });
      return;
    }
    setPolicy((prev) => prev.map((p) => (p.action === action ? { ...p, level } : p)));
  }, []);

  /** Exécute un objectif. `dryRun` constate sans rien écrire. */
  const runObjective = useCallback(
    async (objectiveId: string, dryRun: boolean) => {
      setRunning(objectiveId);
      const data = await orchestrator.invoke({ objective_id: objectiveId, dry_run: dryRun });
      setRunning(null);
      if (!data) return null;
      const result = (data as { results?: Array<{ summary?: string }> })?.results?.[0];
      toast.success(dryRun ? "Constat effectué" : "Objectif exécuté", {
        description: result?.summary ?? "Aucun constat",
      });
      await load();
      return data;
    },
    [load, orchestrator],
  );

  const revert = useCallback(
    async (actionId: string) => {
      const data = await orchestrator.invoke({ revert_action_id: actionId });
      if (!data) return;
      toast.success((data as { message?: string })?.message ?? "Action annulée");
      await load();
    },
    [load, orchestrator],
  );

  return {
    objectives,
    actions,
    policy,
    loading,
    running,
    reload: load,
    setObjectiveState,
    setPolicyLevel,
    runObjective,
    revert,
  };
}
