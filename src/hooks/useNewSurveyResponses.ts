import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Kind = "mission" | "training";

const CFG: Record<Kind, { responses: string; surveys: string; entityCol: string }> = {
  mission: {
    responses: "mission_survey_responses",
    surveys: "mission_surveys",
    entityCol: "mission_id",
  },
  training: {
    responses: "training_survey_responses",
    surveys: "training_surveys",
    entityCol: "training_id",
  },
};

const lsKey = (kind: Kind, id: string) => `supertools.lastSeen.survey.${kind}.${id}`;

/**
 * Per-entity "new survey response since last visit" alert.
 * Returns a Set of entity ids (mission_id or training_id) that have at least
 * one survey response submitted after the user last visited that entity.
 * Call `markSeen(entityId)` to clear the dot for one entity.
 */
export function useNewSurveyResponses(kind: Kind) {
  const cfg = CFG[kind];
  // Bumped by markSeen so derived set recomputes against fresh localStorage.
  const [, force] = useState(0);

  const { data: latestByEntity = {} } = useQuery({
    queryKey: ["new-survey-responses", kind],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(cfg.responses)
        .select(`submitted_at, ${cfg.surveys}!inner(${cfg.entityCol})`)
        .order("submitted_at", { ascending: false })
        .limit(500);
      if (error) return {} as Record<string, string>;
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as any[]) {
        const entityId: string | undefined = row?.[cfg.surveys]?.[cfg.entityCol];
        const ts: string | undefined = row?.submitted_at;
        if (!entityId || !ts) continue;
        if (!map[entityId] || map[entityId] < ts) map[entityId] = ts;
      }
      return map;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const newSet = new Set<string>();
  if (typeof window !== "undefined") {
    for (const [id, ts] of Object.entries(latestByEntity as Record<string, string>)) {
      const seen = window.localStorage.getItem(lsKey(kind, id)) || "1970-01-01";
      if (new Date(ts).getTime() > new Date(seen).getTime()) newSet.add(id);
    }
  }

  const markSeen = useCallback(
    (entityId: string | null | undefined) => {
      if (typeof window === "undefined" || !entityId) return;
      window.localStorage.setItem(lsKey(kind, entityId), new Date().toISOString());
      force((v) => v + 1);
    },
    [kind],
  );

  return { newSet, hasAny: newSet.size > 0, markSeen };
}
