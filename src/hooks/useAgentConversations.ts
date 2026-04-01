import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export function useAgentConversations() {
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["agent-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_conversations")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ConversationSummary[];
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agent_conversations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-conversations"] });
    },
  });

  return {
    conversations,
    isLoading,
    deleteConversation,
  };
}
