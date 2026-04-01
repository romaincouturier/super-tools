import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/** Extract user/assistant text messages from the raw conversation JSON */
export function parseStoredMessages(raw: Json): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const result: ChatMessage[] = [];

  for (const msg of raw) {
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;
    const role = (msg as Record<string, unknown>).role as string;
    const content = (msg as Record<string, unknown>).content;

    if (role !== "user" && role !== "assistant") continue;

    let text = "";
    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
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

/** Parse SSE lines from a buffer, returns [parsed events, remaining buffer] */
export function parseSSEBuffer(buffer: string): [Array<{ event: string; data: Record<string, unknown> }>, string] {
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const blocks = buffer.split("\n\n");
  const remaining = blocks.pop() || "";

  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventType = "";
    let dataStr = "";

    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.slice(6).trim();
      }
    }

    if (eventType && dataStr) {
      try {
        events.push({ event: eventType, data: JSON.parse(dataStr) });
      } catch {
        // skip malformed
      }
    }
  }

  return [events, remaining];
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
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
      setToolStatus(null);
    } catch (e) {
      console.error("Error loading conversation:", e);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);
      setToolStatus(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create a placeholder assistant message that we'll update progressively
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      try {
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

        // Read SSE stream
        if (!res.body) {
          throw new Error("Réponse vide du serveur");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";

        const processEvents = (events: Array<{ event: string; data: Record<string, unknown> }>) => {
          for (const { event, data } of events) {
            switch (event) {
              case "status":
                setToolStatus(data.text as string);
                break;

              case "delta":
                accumulatedText += data.text as string;
                setToolStatus(null);
                // Update the assistant message in place
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulatedText } : m,
                  ),
                );
                break;

              case "done":
                if (data.conversation_id) {
                  setConversationId(data.conversation_id as string);
                }
                // Ensure final content is set
                if (data.response) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: data.response as string } : m,
                    ),
                  );
                }
                break;

              case "error":
                throw new Error(data.text as string);
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const [events, remaining] = parseSSEBuffer(buffer);
          buffer = remaining;
          processEvents(events);
        }

        // Flush remaining buffer after stream ends
        if (buffer.trim()) {
          const [finalEvents] = parseSSEBuffer(buffer + "\n\n");
          processEvents(finalEvents);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Remove empty assistant placeholder on cancel
          setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content));
          return;
        }
        const msg = err instanceof Error ? err.message : "Une erreur est survenue";
        setError(msg);
        // Update placeholder with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Erreur : ${msg}` } : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setToolStatus(null);
        abortRef.current = null;
      }
    },
    [conversationId, isLoading],
  );

  const newConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setToolStatus(null);
  }, []);

  const regenerateLastResponse = useCallback(() => {
    if (isLoading) return;
    // Find the last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message and the last user message (sendMessage will re-add it)
    setMessages((prev) => {
      let lastAssistantIdx = -1;
      let lastUserIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (lastAssistantIdx === -1 && prev[i].role === "assistant") lastAssistantIdx = i;
        if (lastUserIdx === -1 && prev[i].role === "user") lastUserIdx = i;
        if (lastAssistantIdx !== -1 && lastUserIdx !== -1) break;
      }
      return prev.filter((_, i) => i !== lastAssistantIdx && i !== lastUserIdx);
    });

    sendMessage(lastUserMsg.content);
  }, [messages, isLoading, sendMessage]);

  const cancelRequest = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setToolStatus(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    toolStatus,
    sendMessage,
    newConversation,
    loadConversation,
    cancelRequest,
    regenerateLastResponse,
  };
}
