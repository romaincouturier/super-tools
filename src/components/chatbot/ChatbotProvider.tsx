import { useEffect, useState } from "react";
import { ChatbotWidget } from "./ChatbotWidget";
import { supabase } from "@/integrations/supabase/client";

/**
 * ChatbotProvider - Renders the chatbot widget only for authenticated staff users.
 * Learners (user_metadata.role === "learner") are explicitly excluded: the chatbot
 * exposes Super Tools platform knowledge that must never be visible to learners.
 */
export function ChatbotProvider() {
  const [showChatbot, setShowChatbot] = useState(false);

  const isStaffSession = (session: { user: { user_metadata?: Record<string, unknown> } } | null) => {
    if (!session) return false;
    return session.user.user_metadata?.role !== "learner";
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setShowChatbot(isStaffSession(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setShowChatbot(isStaffSession(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!showChatbot) return null;

  return <ChatbotWidget />;
}
