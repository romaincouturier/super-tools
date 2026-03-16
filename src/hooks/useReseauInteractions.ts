import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NetworkInteraction } from "@/types/reseau";
import { CONTACTS_KEY } from "./useReseauContacts";

export const INTERACTIONS_KEY = "network-interactions";

export const useLogInteraction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contact_id: string;
      interaction_type: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("network_interactions")
        .insert({ user_id: user.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
    },
  });
};

export const useNetworkInteractions = () => {
  return useQuery({
    queryKey: [INTERACTIONS_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase
        .from("network_interactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NetworkInteraction[];
    },
  });
};
