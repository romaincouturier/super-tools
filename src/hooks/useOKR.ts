import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  OKRObjective,
  OKRKeyResult,
  OKRInitiative,
  OKRParticipant,
  OKRCheckIn,
  CreateOKRObjectiveInput,
  UpdateOKRObjectiveInput,
  CreateOKRKeyResultInput,
  UpdateOKRKeyResultInput,
  CreateOKRInitiativeInput,
  UpdateOKRInitiativeInput,
  CreateOKRCheckInInput,
} from "@/types/okr";

const OKR_OBJECTIVES_KEY = "okr-objectives";
const OKR_KEY_RESULTS_KEY = "okr-key-results";
const OKR_INITIATIVES_KEY = "okr-initiatives";
const OKR_PARTICIPANTS_KEY = "okr-participants";
const OKR_CHECK_INS_KEY = "okr-check-ins";
const OKR_FAVORITES_KEY = "okr-favorites";

// ===============================
// Objectives Hooks
// ===============================

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
        .select(`
          *,
          okr_key_results (
            id,
            title,
            progress_percentage,
            confidence_level
          )
        `)
        .eq("is_favorite", true)
        .order("favorite_position", { ascending: true })
        .limit(3);

      if (error) throw error;
      return (data || []) as (OKRObjective & { okr_key_results: OKRKeyResult[] })[];
    },
  });
};

export const useCreateOKRObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRObjectiveInput) => {
      // Get max position
      const { data: existing } = await (supabase as any)
        .from("okr_objectives")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;

      const { data, error } = await (supabase as any)
        .from("okr_objectives")
        .insert({
          ...input,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OKRObjective;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
    },
  });
};

export const useUpdateOKRObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateOKRObjectiveInput }) => {
      const { data, error } = await (supabase as any)
        .from("okr_objectives")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as OKRObjective;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

export const useDeleteOKRObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("okr_objectives")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

export const useToggleOKRFavorite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { data, error } = await (supabase as any)
        .from("okr_objectives")
        .update({ is_favorite: isFavorite })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as OKRObjective;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

// ===============================
// Key Results Hooks
// ===============================

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

export const useCreateOKRKeyResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRKeyResultInput) => {
      const { data: existing } = await (supabase as any)
        .from("okr_key_results")
        .select("position")
        .eq("objective_id", input.objective_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;

      const { data, error } = await (supabase as any)
        .from("okr_key_results")
        .insert({
          ...input,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OKRKeyResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY, data.objective_id] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

export const useUpdateOKRKeyResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, objectiveId, updates }: { id: string; objectiveId: string; updates: UpdateOKRKeyResultInput }) => {
      const { data, error } = await (supabase as any)
        .from("okr_key_results")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, objectiveId } as OKRKeyResult & { objectiveId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY, data.objectiveId] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

export const useDeleteOKRKeyResult = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, objectiveId }: { id: string; objectiveId: string }) => {
      const { error } = await (supabase as any)
        .from("okr_key_results")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { objectiveId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY, data.objectiveId] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

// ===============================
// Initiatives Hooks
// ===============================

export const useOKRInitiatives = (keyResultId: string | null) => {
  return useQuery({
    queryKey: [OKR_INITIATIVES_KEY, keyResultId],
    queryFn: async () => {
      if (!keyResultId) return [];

      const { data, error } = await (supabase as any)
        .from("okr_initiatives")
        .select(`
          *,
          linked_mission:missions(id, title),
          linked_training:trainings(id, training_name)
        `)
        .eq("key_result_id", keyResultId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as OKRInitiative[];
    },
    enabled: !!keyResultId,
  });
};

export const useCreateOKRInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRInitiativeInput) => {
      const { data: existing } = await (supabase as any)
        .from("okr_initiatives")
        .select("position")
        .eq("key_result_id", input.key_result_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;

      const { data, error } = await (supabase as any)
        .from("okr_initiatives")
        .insert({
          ...input,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as OKRInitiative;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_INITIATIVES_KEY, data.key_result_id] });
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
    },
  });
};

export const useUpdateOKRInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, keyResultId, updates }: { id: string; keyResultId: string; updates: UpdateOKRInitiativeInput }) => {
      const { data, error } = await (supabase as any)
        .from("okr_initiatives")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, keyResultId } as OKRInitiative & { keyResultId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_INITIATIVES_KEY, data.keyResultId] });
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
    },
  });
};

export const useDeleteOKRInitiative = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, keyResultId }: { id: string; keyResultId: string }) => {
      const { error } = await (supabase as any)
        .from("okr_initiatives")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { keyResultId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_INITIATIVES_KEY, data.keyResultId] });
      queryClient.invalidateQueries({ queryKey: [OKR_KEY_RESULTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
    },
  });
};

// ===============================
// Participants Hooks
// ===============================

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

export const useAddOKRParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { objective_id: string; email: string; name?: string; role?: string }) => {
      const { data, error } = await (supabase as any)
        .from("okr_participants")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as OKRParticipant;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_PARTICIPANTS_KEY, data.objective_id] });
    },
  });
};

export const useRemoveOKRParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, objectiveId }: { id: string; objectiveId: string }) => {
      const { error } = await (supabase as any)
        .from("okr_participants")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { objectiveId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_PARTICIPANTS_KEY, data.objectiveId] });
    },
  });
};

// ===============================
// Check-ins Hooks
// ===============================

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

export const useCreateOKRCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRCheckInInput) => {
      // Get current objective state
      const { data: objective } = await (supabase as any)
        .from("okr_objectives")
        .select("progress_percentage, confidence_level")
        .eq("id", input.objective_id)
        .single();

      const { data, error } = await (supabase as any)
        .from("okr_check_ins")
        .insert({
          ...input,
          previous_progress: objective?.progress_percentage || 0,
          previous_confidence: objective?.confidence_level || 50,
        })
        .select()
        .single();

      if (error) throw error;

      // Update objective with new progress and confidence
      await (supabase as any)
        .from("okr_objectives")
        .update({
          progress_percentage: input.new_progress,
          confidence_level: input.new_confidence,
        })
        .eq("id", input.objective_id);

      return data as OKRCheckIn;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_CHECK_INS_KEY, data.objective_id] });
      queryClient.invalidateQueries({ queryKey: [OKR_OBJECTIVES_KEY] });
      queryClient.invalidateQueries({ queryKey: [OKR_FAVORITES_KEY] });
    },
  });
};

// ===============================
// Statistics Hooks
// ===============================

export const useOKRStatistics = (year?: number) => {
  return useQuery({
    queryKey: ["okr-statistics", year],
    queryFn: async () => {
      const targetYear = year || new Date().getFullYear();

      const { data: objectives, error } = await (supabase as any)
        .from("okr_objectives")
        .select(`
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
        `)
        .eq("target_year", targetYear);

      if (error) throw error;

      const stats = {
        totalObjectives: objectives?.length || 0,
        activeObjectives: objectives?.filter((o: any) => o.status === "active").length || 0,
        completedObjectives: objectives?.filter((o: any) => o.status === "completed").length || 0,
        avgProgress: objectives?.length
          ? Math.round(objectives.reduce((sum: number, o: any) => sum + o.progress_percentage, 0) / objectives.length)
          : 0,
        avgConfidence: objectives?.length
          ? Math.round(objectives.reduce((sum: number, o: any) => sum + o.confidence_level, 0) / objectives.length)
          : 0,
        byQuarter: {} as Record<string, { count: number; avgProgress: number }>,
      };

      // Calculate by quarter
      objectives?.forEach((o: any) => {
        if (!stats.byQuarter[o.time_target]) {
          stats.byQuarter[o.time_target] = { count: 0, avgProgress: 0 };
        }
        stats.byQuarter[o.time_target].count++;
        stats.byQuarter[o.time_target].avgProgress += o.progress_percentage;
      });

      // Calculate averages
      Object.keys(stats.byQuarter).forEach((key) => {
        stats.byQuarter[key].avgProgress = Math.round(
          stats.byQuarter[key].avgProgress / stats.byQuarter[key].count
        );
      });

      return stats;
    },
  });
};
