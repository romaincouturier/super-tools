/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OKRObjective, OKRKeyResult, OKRInitiative, OKRParticipant, OKRCheckIn } from "@/types/okr";

export const OKR_OBJECTIVES_KEY = "okr-objectives";
export const OKR_KEY_RESULTS_KEY = "okr-key-results";
export const OKR_INITIATIVES_KEY = "okr-initiatives";
export const OKR_PARTICIPANTS_KEY = "okr-participants";
export const OKR_CHECK_INS_KEY = "okr-check-ins";
export const OKR_FAVORITES_KEY = "okr-favorites";

// Objectives
export const useOKRObjectives = (filters?: { status?: string; year?: number }) => {
  return useQuery({
    queryKey: [OKR_OBJECTIVES_KEY, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("okr_objectives")
        .select("*")
        .order("position", { ascending: true });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.year) {
        query = query.eq("target_year", filters.year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OKRObjective[];
    },
  });
};

export const useOKRObjective = (objectiveId: string | null) => {
  return useQuery({
    queryKey: [OKR_OBJECTIVES_KEY, objectiveId],
    queryFn: async () => {
      if (!objectiveId) return null;

      const { data, error } = await (supabase as any)
        .from("okr_objectives")
        .select("*")
        .eq("id", objectiveId)
        .single();

      if (error) throw error;
      return data as OKRObjective;
    },
    enabled: !!objectiveId,
  });
};

export const useOKRFavorites = () => {
  return useQuery({
    queryKey: [OKR_FAVORITES_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("okr_objectives")
        .select(
          `
          *,
          okr_key_results (
            id,
            title,
            progress_percentage,
            confidence_level
          )
        `,
        )
        .eq("is_favorite", true)
        .order("favorite_position", { ascending: true })
        .limit(3);

      if (error) throw error;
      return (data || []) as (OKRObjective & { okr_key_results: OKRKeyResult[] })[];
    },
  });
};

// Key Results
export const useOKRKeyResults = (objectiveId: string | null) => {
  return useQuery({
    queryKey: [OKR_KEY_RESULTS_KEY, objectiveId],
    queryFn: async () => {
      if (!objectiveId) return [];

      const { data, error } = await (supabase as any)
        .from("okr_key_results")
        .select("*")
        .eq("objective_id", objectiveId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as OKRKeyResult[];
    },
    enabled: !!objectiveId,
  });
};

// Initiatives
export const useOKRInitiatives = (keyResultId: string | null) => {
  return useQuery({
    queryKey: [OKR_INITIATIVES_KEY, keyResultId],
    queryFn: async () => {
      if (!keyResultId) return [];

      const { data, error } = await (supabase as any)
        .from("okr_initiatives")
        .select("*")
        .eq("key_result_id", keyResultId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as OKRInitiative[];
    },
    enabled: !!keyResultId,
  });
};

// Participants
export const useOKRParticipants = (objectiveId: string | null) => {
  return useQuery({
    queryKey: [OKR_PARTICIPANTS_KEY, objectiveId],
    queryFn: async () => {
      if (!objectiveId) return [];

      const { data, error } = await (supabase as any)
        .from("okr_participants")
        .select("*")
        .eq("objective_id", objectiveId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as OKRParticipant[];
    },
    enabled: !!objectiveId,
  });
};

// Check-ins
export const useOKRCheckIns = (objectiveId: string | null) => {
  return useQuery({
    queryKey: [OKR_CHECK_INS_KEY, objectiveId],
    queryFn: async () => {
      if (!objectiveId) return [];

      const { data, error } = await (supabase as any)
        .from("okr_check_ins")
        .select("*")
        .eq("objective_id", objectiveId)
        .order("check_in_date", { ascending: false });

      if (error) throw error;
      return (data || []) as OKRCheckIn[];
    },
    enabled: !!objectiveId,
  });
};

// Statistics
export const useOKRStatistics = (year?: number) => {
  return useQuery({
    queryKey: ["okr-statistics", year],
    queryFn: async () => {
      const targetYear = year || new Date().getFullYear();

      const { data: objectives, error } = await (supabase as any)
        .from("okr_objectives")
        .select(
          `
          id,
          status,
          progress_percentage,
          confidence_level,
          time_target,
          okr_key_results (
            id,
            progress_percentage,
            confidence_level
          )
        `,
        )
        .eq("target_year", targetYear);

      if (error) throw error;

      type OKRObjectiveRow = {
        id: string;
        status: string;
        progress_percentage: number;
        confidence_level: number;
        time_target: string;
      };
      const typedObjectives = (objectives || []) as OKRObjectiveRow[];

      const stats = {
        totalObjectives: typedObjectives.length,
        activeObjectives: typedObjectives.filter((o) => o.status === "active").length,
        completedObjectives: typedObjectives.filter((o) => o.status === "completed").length,
        avgProgress: typedObjectives.length
          ? Math.round(
              typedObjectives.reduce((sum, o) => sum + o.progress_percentage, 0) /
                typedObjectives.length,
            )
          : 0,
        avgConfidence: typedObjectives.length
          ? Math.round(
              typedObjectives.reduce((sum, o) => sum + o.confidence_level, 0) /
                typedObjectives.length,
            )
          : 0,
        byQuarter: {} as Record<string, { count: number; avgProgress: number }>,
      };

      typedObjectives.forEach((o) => {
        if (!stats.byQuarter[o.time_target]) {
          stats.byQuarter[o.time_target] = { count: 0, avgProgress: 0 };
        }
        stats.byQuarter[o.time_target].count++;
        stats.byQuarter[o.time_target].avgProgress += o.progress_percentage;
      });

      Object.keys(stats.byQuarter).forEach((key) => {
        stats.byQuarter[key].avgProgress = Math.round(
          stats.byQuarter[key].avgProgress / stats.byQuarter[key].count,
        );
      });

      return stats;
    },
  });
};
