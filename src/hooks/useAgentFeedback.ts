import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAgentFeedback() {
  const submitFeedback = useCallback(async (params: {
    conversationId: string | null;
    rating: "up" | "down";
    userPrompt: string;
    assistantResponse: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await (supabase as any).from("agent_feedback").insert({
      user_id: user.id,
      conversation_id: params.conversationId,
      rating: params.rating,
      user_prompt: params.userPrompt,
      assistant_response: params.assistantResponse,
    });

    if (error) {
      console.error("Feedback error:", error);
      toast.error("Erreur lors de l'envoi du feedback");
    } else {
      toast.success(params.rating === "up" ? "Merci pour le feedback positif !" : "Feedback enregistré, on va améliorer ça");
    }
  }, []);

  return { submitFeedback };
}
