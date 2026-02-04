import { useEffect, useState } from "react";
import { ChatbotWidget } from "./ChatbotWidget";
import { supabase } from "@/integrations/supabase/client";

/**
 * ChatbotProvider - Renders the chatbot widget only for authenticated users
 * Should be placed at the app level to persist across page navigations
 */
export function ChatbotProvider() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Only render chatbot for authenticated users
  if (!isAuthenticated) {
    return null;
  }

  return <ChatbotWidget />;
}
