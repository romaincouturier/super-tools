import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OKRObjective, OKRKeyResult, OKRCheckIn } from "@/types/okr";
import {
  computeRiskAlerts,
  computeMomentum,
  computeSnapshot,
  OKRRiskAlert,
  MomentumData,
  OKRSnapshot,
} from "@/lib/okrRiskEngine";

interface OKRInsightsData {
  objectives: OKRObjective[];
  keyResultsByObjective: Record<string, OKRKeyResult[]>;
  checkInsByObjective: Record<string, OKRCheckIn[]>;
  alerts: OKRRiskAlert[];
  momentum: MomentumData[];
  snapshot: OKRSnapshot;
}

export const useOKRInsights = (year: number) => {
  return useQuery({
    queryKey: ["okr-insights", year],
    queryFn: async (): Promise<OKRInsightsData> => {
      // Fetch all objectives for the year
      const { data: objectives, error: objError } = await (supabase as any)
        .from("okr_objectives")
        .select("*")
        .eq("target_year", year)
        .order("position", { ascending: true });

      if (objError) throw objError;
      const objs = (objectives || []) as OKRObjective[];

      const objectiveIds = objs.map((o) => o.id);

      // Fetch all key results for these objectives
      const { data: allKRs, error: krError } = objectiveIds.length
        ? await (supabase as any)
            .from("okr_key_results")
            .select("*")
            .in("objective_id", objectiveIds)
            .order("position", { ascending: true })
        : { data: [], error: null };

      if (krError) throw krError;

      const keyResultsByObjective: Record<string, OKRKeyResult[]> = {};
      for (const kr of (allKRs || []) as OKRKeyResult[]) {
        if (!keyResultsByObjective[kr.objective_id]) {
          keyResultsByObjective[kr.objective_id] = [];
        }
        keyResultsByObjective[kr.objective_id].push(kr);
      }

      // Fetch all check-ins for these objectives
      const { data: allCheckIns, error: ciError } = objectiveIds.length
        ? await (supabase as any)
            .from("okr_check_ins")
            .select("*")
            .in("objective_id", objectiveIds)
            .order("check_in_date", { ascending: false })
        : { data: [], error: null };

      if (ciError) throw ciError;

      const checkInsByObjective: Record<string, OKRCheckIn[]> = {};
      for (const ci of (allCheckIns || []) as OKRCheckIn[]) {
        if (!checkInsByObjective[ci.objective_id]) {
          checkInsByObjective[ci.objective_id] = [];
        }
        checkInsByObjective[ci.objective_id].push(ci);
      }

      // Compute insights
      const alerts = computeRiskAlerts(objs, keyResultsByObjective, checkInsByObjective);
      const momentum = computeMomentum(objs, checkInsByObjective);
      const snapshot = computeSnapshot(objs, checkInsByObjective, alerts);

      return {
        objectives: objs,
        keyResultsByObjective,
        checkInsByObjective,
        alerts,
        momentum,
        snapshot,
      };
    },
    staleTime: 60_000,
  });
};
