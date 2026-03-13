import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NetworkContact,
  UserPositioning,
  NetworkMessage,
  ConversationPhase,
  NetworkAIResponse,
} from "@/types/reseau";

export const CONVERSATION_KEY = "network-conversation";

export const useNetworkConversation = (phase: ConversationPhase) => {
  return useQuery({
    queryKey: [CONVERSATION_KEY, phase],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("network_conversation")
        .select("*")
        .eq("user_id", user.id)
        .eq("phase", phase)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as NetworkMessage[];
    },
  });
};

export const useSendNetworkMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      phase,
      positioning,
      contacts,
    }: {
      content: string;
      phase: ConversationPhase;
      positioning?: UserPositioning | null;
      contacts?: NetworkContact[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save user message
      await (supabase as any)
        .from("network_conversation")
        .insert({ user_id: user.id, role: "user", content, phase });

      // Get full conversation history
      const { data: history } = await (supabase as any)
        .from("network_conversation")
        .select("role, content")
        .eq("user_id", user.id)
        .eq("phase", phase)
        .order("created_at", { ascending: true });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("network-ai-assistant", {
        body: {
          messages: history || [],
          phase,
          positioning: positioning || undefined,
          contacts: contacts || undefined,
        },
      });

      if (error) throw error;
      const aiResponse = data as NetworkAIResponse;

      // Save assistant message
      await (supabase as any)
        .from("network_conversation")
        .insert({ user_id: user.id, role: "assistant", content: aiResponse.reply, phase });

      return aiResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATION_KEY, variables.phase] });
    },
  });
};
