/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  OKR_OBJECTIVES_KEY,
  OKR_KEY_RESULTS_KEY,
  OKR_INITIATIVES_KEY,
  OKR_PARTICIPANTS_KEY,
  OKR_CHECK_INS_KEY,
  OKR_FAVORITES_KEY,
} from "@/hooks/queries/useOKRQueries";

// Objective mutations
export const useCreateOKRObjective = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRObjectiveInput) => {
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
      const { error } = await (supabase as any).from("okr_objectives").delete().eq("id", id);

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

// Key Result mutations
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
    mutationFn: async ({
      id,
      objectiveId,
      updates,
    }: {
      id: string;
      objectiveId: string;
      updates: UpdateOKRKeyResultInput;
    }) => {
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
      const { error } = await (supabase as any).from("okr_key_results").delete().eq("id", id);

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

// Initiative mutations
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
    mutationFn: async ({
      id,
      keyResultId,
      updates,
    }: {
      id: string;
      keyResultId: string;
      updates: UpdateOKRInitiativeInput;
    }) => {
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
      const { error } = await (supabase as any).from("okr_initiatives").delete().eq("id", id);

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

// Participant mutations
export const useAddOKRParticipant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      objective_id: string;
      email: string;
      name?: string;
      role?: string;
    }) => {
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
      const { error } = await (supabase as any).from("okr_participants").delete().eq("id", id);

      if (error) throw error;
      return { objectiveId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [OKR_PARTICIPANTS_KEY, data.objectiveId] });
    },
  });
};

// Check-in mutations
export const useCreateOKRCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOKRCheckInInput) => {
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
