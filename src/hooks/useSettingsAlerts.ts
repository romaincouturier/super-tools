import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Settings tab keys that can carry an alert badge. Must match the
 * `<TabsTrigger value>` keys used in `src/pages/Parametres.tsx`.
 */
export type SettingsTabKey =
  | "general"
  | "trainers"
  | "crm"
  | "emails"
  | "access"
  | "integrations"
  | "backup"
  | "billing"
  | "arena"
  | "devis"
  | "voice"
  | "agent";

export interface SettingsAlerts {
  /** One flag per tab. true ⇒ something needs attention in that tab. */
  byTab: Record<SettingsTabKey, boolean>;
  /** Aggregate — true if any tab has an alert. Used for the header icon. */
  hasAny: boolean;
}

/**
 * Aggregates "something is wrong, go look" signals across the settings
 * tabs so the header Settings icon and each tab trigger can render a
 * small red dot.
 *
 * Current signals:
 *  - `agent`: at least one entry in `indexation_queue` is stuck (pending
 *    for more than 5 min). Mirrors the logic already shown inside
 *    AgentIndexationSettings.tsx so both indicators stay in sync.
 *
 * Extending: add a new `useQuery(...)` below, combine into `byTab`. All
 * tabs default to `false` so unknown/non-instrumented tabs never alert.
 */
export function useSettingsAlerts(): SettingsAlerts {
  const { data: agentStuck = 0 } = useQuery({
    queryKey: ["settings-alerts", "agent-indexation-stuck"],
    queryFn: async (): Promise<number> => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from("indexation_queue")
        .select("*", { count: "exact", head: true })
        .is("processed_at", null)
        .lt("created_at", fiveMinAgo);
      if (error) return 0;
      return count ?? 0;
    },
    // Auto-refresh every minute so the dot clears/appears without navigation.
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const byTab: Record<SettingsTabKey, boolean> = {
    general: false,
    trainers: false,
    crm: false,
    emails: false,
    access: false,
    integrations: false,
    backup: false,
    billing: false,
    arena: false,
    devis: false,
    voice: false,
    agent: agentStuck > 0,
  };

  return {
    byTab,
    hasAny: Object.values(byTab).some(Boolean),
  };
}
