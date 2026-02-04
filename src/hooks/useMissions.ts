import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mission, CreateMissionInput, UpdateMissionInput, MissionStatus } from "@/types/missions";

const MISSIONS_QUERY_KEY = "missions";

// Fetch all missions
export const useMissions = () => {
  return useQuery({
    queryKey: [MISSIONS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      return data as Mission[];
    },
  });
};

// Search missions (for referencing in CRM)
export const useSearchMissions = (searchTerm: string) => {
  return useQuery({
    queryKey: [MISSIONS_QUERY_KEY, "search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];

      const { data, error } = await supabase
        .from("missions")
        .select("id, title, client_name, status, start_date, end_date")
        .or(`title.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Pick<Mission, 'id' | 'title' | 'client_name' | 'status' | 'start_date' | 'end_date'>[];
    },
    enabled: searchTerm.length >= 2,
  });
};

// Create mission
export const useCreateMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      // Get max position for ordering
      const { data: existingMissions } = await supabase
        .from("missions")
        .select("position")
        .eq("status", input.status || "not_started")
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existingMissions?.[0]?.position ?? -1;

      const { data, error } = await supabase
        .from("missions")
        .insert({
          ...input,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Update mission
export const useUpdateMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateMissionInput }) => {
      const { data, error } = await supabase
        .from("missions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Delete mission
export const useDeleteMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Move mission (change status/position)
export const useMoveMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      missionId,
      newStatus,
      newPosition,
    }: {
      missionId: string;
      newStatus: MissionStatus;
      newPosition: number;
    }) => {
      const { error } = await supabase
        .from("missions")
        .update({ status: newStatus, position: newPosition })
        .eq("id", missionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};
