import { describe, it, expect } from "vitest";
import { parseStoredMessages, parseSSEBuffer } from "./useAgentChat";

// ── parseStoredMessages ─────────────────────────────────────

describe("parseStoredMessages", () => {
  it("returns empty array for non-array input", () => {
    expect(parseStoredMessages(null)).toEqual([]);
    expect(parseStoredMessages("string")).toEqual([]);
    expect(parseStoredMessages(42)).toEqual([]);
    expect(parseStoredMessages({})).toEqual([]);
  });

  it("parses user messages with string content", () => {
    const raw = [{ role: "user", content: "Bonjour" }];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toBe("Bonjour");
  });

  it("parses assistant messages with string content", () => {
    const raw = [{ role: "assistant", content: "Voici la réponse" }];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("assistant");
    expect(result[0].content).toBe("Voici la réponse");
  });

  it("extracts text from content blocks, skipping tool_use", () => {
    const raw = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Je recherche..." },
          { type: "tool_use", id: "t1", name: "query_database", input: {} },
          { type: "text", text: "Voici les résultats." },
        ],
      },
    ];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Je recherche...\nVoici les résultats.");
  });

  it("skips tool_result messages (role=user with tool results)", () => {
    const raw = [
      { role: "user", content: "Question" },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "t1", name: "query_database", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: "[...]" },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Réponse finale" }],
      },
    ];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Question");
    expect(result[1].content).toBe("Réponse finale");
  });

  it("skips messages with empty content", () => {
    const raw = [
      { role: "user", content: "" },
      { role: "assistant", content: [] },
      { role: "user", content: "Vraie question" },
    ];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Vraie question");
  });

  it("ignores non-user/non-assistant roles", () => {
    const raw = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Question" },
    ];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("user");
  });

  it("handles null/undefined entries gracefully", () => {
    const raw = [null, undefined, { role: "user", content: "Test" }, 42];
    const result = parseStoredMessages(raw);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Test");
  });
});

// ── parseSSEBuffer ──────────────────────────────────────────

describe("parseSSEBuffer", () => {
  it("parses a complete SSE event", () => {
    const buffer = 'event: delta\ndata: {"text":"Hello"}\n\n';
    const [events, remaining] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("delta");
    expect(events[0].data).toEqual({ text: "Hello" });
    expect(remaining).toBe("");
  });

  it("parses multiple events", () => {
    const buffer =
      'event: status\ndata: {"text":"Recherche..."}\n\nevent: delta\ndata: {"text":"Résultat"}\n\n';
    const [events, remaining] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("status");
    expect(events[1].event).toBe("delta");
    expect(remaining).toBe("");
  });

  it("keeps incomplete event in remaining buffer", () => {
    const buffer = 'event: delta\ndata: {"text":"Hello"}\n\nevent: status\ndata: {"te';
    const [events, remaining] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ text: "Hello" });
    expect(remaining).toBe('event: status\ndata: {"te');
  });

  it("returns empty events for empty buffer", () => {
    const [events, remaining] = parseSSEBuffer("");
    expect(events).toEqual([]);
    expect(remaining).toBe("");
  });

  it("skips malformed JSON data", () => {
    const buffer = "event: delta\ndata: {broken json}\n\nevent: done\ndata: {\"ok\":true}\n\n";
    const [events] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("done");
  });

  it("skips events without data", () => {
    const buffer = 'event: heartbeat\n\nevent: delta\ndata: {"text":"ok"}\n\n';
    const [events] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("delta");
  });

  it("handles done event with conversation_id", () => {
    const buffer = 'event: done\ndata: {"conversation_id":"abc-123","response":"Réponse"}\n\n';
    const [events] = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(events[0].data.conversation_id).toBe("abc-123");
    expect(events[0].data.response).toBe("Réponse");
  });
});
