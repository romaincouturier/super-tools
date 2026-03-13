import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserPositioning } from "@/types/reseau";

export const POSITIONING_KEY = "network-positioning";

export const usePositioning = () => {
  return useQuery({
    queryKey: [POSITIONING_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("user_positioning")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserPositioning | null;
    },
  });
};

export const useUpsertPositioning = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pitch_one_liner: string;
      key_skills: string[];
      target_client: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("user_positioning")
        .upsert(
          {
            user_id: user.id,
            ...input,
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as UserPositioning;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSITIONING_KEY] });
    },
  });
};
