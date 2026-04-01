import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AgentResponse {
  response: string;
  conversation_id: string;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Get auth token
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("Non authentifié");
        }

        abortRef.current = new AbortController();

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              message: content.trim(),
              conversation_id: conversationId,
            }),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(errBody || `Erreur ${res.status}`);
        }

        const data: AgentResponse = await res.json();

        // Save conversation id for follow-up messages
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Une erreur est survenue";
        setError(msg);
        // Add error as assistant message so user sees it in the chat
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Erreur : ${msg}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [conversationId, isLoading],
  );

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    sendMessage,
    newConversation,
    cancelRequest,
  };
}
