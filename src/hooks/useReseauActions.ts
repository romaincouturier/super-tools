import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NetworkContact,
  NetworkAction,
  UserPositioning,
  GeneratedAction,
} from "@/types/reseau";
import { CONTACTS_KEY } from "./useReseauContacts";
import { INTERACTIONS_KEY } from "./useReseauInteractions";

export const ACTIONS_KEY = "network-actions";

export const useNetworkActions = (week?: string) => {
  return useQuery({
    queryKey: [ACTIONS_KEY, week],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let query = (supabase as any)
        .from("network_actions")
        .select("*, contact:network_contacts(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (week) {
        query = query.eq("scheduled_week", week);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as (NetworkAction & { contact: NetworkContact | null })[];
    },
  });
};

export const useGenerateWeeklyActions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      positioning,
      contacts,
    }: {
      positioning: UserPositioning;
      contacts: NetworkContact[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase.functions.invoke("network-generate-actions", {
        body: { positioning, contacts },
      });
      if (error) throw error;

      const generated = (data as { actions: GeneratedAction[] }).actions;
      const today = new Date().toISOString().split("T")[0];

      // Save generated actions to DB
      if (generated.length > 0) {
        const rows = generated.map((a) => ({
          user_id: user.id,
          contact_id: a.contact_id,
          action_type: a.action_type,
          message_draft: a.message_draft,
          scheduled_week: today,
          status: "pending" as const,
        }));

        await (supabase as any).from("network_actions").insert(rows);
      }

      return generated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTIONS_KEY] });
    },
  });
};

export const useUpdateActionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, result, contactId, actionType }: {
      id: string;
      status: "done" | "skipped";
      result?: string;
      contactId?: string;
      actionType?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await (supabase as any)
        .from("network_actions")
        .update({
          status,
          result: result || null,
          done_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;

      // Auto-log interaction when action is marked as done
      if (status === "done" && contactId) {
        await (supabase as any)
          .from("network_interactions")
          .insert({
            user_id: user.id,
            contact_id: contactId,
            interaction_type: actionType || "other",
            notes: `Action complétée${result ? `: ${result}` : ""}`,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
    },
  });
};
