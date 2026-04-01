import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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

/** Extract user/assistant text messages from the raw conversation JSON */
function parseStoredMessages(raw: Json): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const result: ChatMessage[] = [];

  for (const msg of raw) {
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;
    const role = (msg as Record<string, unknown>).role as string;
    const content = (msg as Record<string, unknown>).content;

    if (role !== "user" && role !== "assistant") continue;

    // Content can be a string or an array of content blocks
    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      // Extract text blocks, skip tool_use / tool_result blocks
      text = (content as Array<Record<string, unknown>>)
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n");
    }

    if (!text) continue;

    result.push({
      id: crypto.randomUUID(),
      role: role as "user" | "assistant",
      content: text,
      timestamp: new Date(),
    });
  }

  return result;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("agent_conversations")
        .select("id, messages")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        console.error("Failed to load conversation:", fetchError);
        return;
      }

      setConversationId(data.id);
      setMessages(parseStoredMessages(data.messages));
      setError(null);
    } catch (e) {
      console.error("Error loading conversation:", e);
    }
  }, []);

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
    loadConversation,
    cancelRequest,
  };
}
