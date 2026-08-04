import { describe, it, expect } from "vitest";
import {
  compactForApi,
  withCacheBreakpoints,
  KEEP_RECENT_MESSAGES,
  type Message,
} from "./agent-history.ts";

function userText(text: string): Message {
  return { role: "user", content: text };
}

function assistantToolUse(id: string, name: string): Message {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "Je consulte." },
      { type: "tool_use", id, name, input: {} },
    ],
  };
}

function toolResult(id: string, content: string): Message {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: id, content }],
  };
}

/** Simule un tour d'agent : N rounds de tool loop sur un historique de départ. */
function simulateTurn(initial: Message[], rounds: number) {
  const history = [...initial];
  const cutoff = history.length - KEEP_RECENT_MESSAGES;
  const rendered: Message[][] = [];

  for (let r = 0; r < rounds; r++) {
    rendered.push(withCacheBreakpoints(compactForApi(history, cutoff)));
    history.push(assistantToolUse(`t${r}`, "query_database"));
    history.push(toolResult(`t${r}`, "x".repeat(5000)));
  }
  return rendered;
}

describe("compactForApi", () => {
  it("tronque les tool_results au-delà de la fenêtre récente", () => {
    const messages: Message[] = [
      userText("question"),
      assistantToolUse("t0", "query_database"),
      toolResult("t0", "y".repeat(5000)),
      ...Array.from({ length: KEEP_RECENT_MESSAGES }, (_, i) => userText(`filler ${i}`)),
    ];

    const out = compactForApi(messages);
    const block = (out[2].content as Array<Record<string, unknown>>)[0];
    expect(String(block.content).length).toBeLessThan(5000);
    expect(String(block.content)).toContain("résultat tronqué");
  });

  it("laisse intacts les résultats des tools de lecture de contenu", () => {
    const long = "z".repeat(5000);
    const messages: Message[] = [
      userText("question"),
      assistantToolUse("t0", "read_document"),
      toolResult("t0", long),
      ...Array.from({ length: KEEP_RECENT_MESSAGES }, (_, i) => userText(`filler ${i}`)),
    ];

    const out = compactForApi(messages);
    const block = (out[2].content as Array<Record<string, unknown>>)[0];
    expect(block.content).toBe(long);
  });

  it("ne mute pas les messages d'origine", () => {
    const messages: Message[] = [
      userText("question"),
      assistantToolUse("t0", "query_database"),
      toolResult("t0", "w".repeat(5000)),
      ...Array.from({ length: KEEP_RECENT_MESSAGES }, (_, i) => userText(`filler ${i}`)),
    ];

    compactForApi(messages);
    const original = (messages[2].content as Array<Record<string, unknown>>)[0];
    expect(String(original.content).length).toBe(5000);
  });

  it("avec une fenêtre figée, le préfixe déjà rendu ne change plus", () => {
    // L'invariant qui rend le prompt caching exploitable : sans cutoff figé,
    // un message envoyé entier au round N est tronqué au round N+3 et le
    // cache est perdu à chaque round.
    const initial: Message[] = [
      userText("question"),
      ...Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? assistantToolUse(`init${i}`, "query_database")
          : toolResult(`init${i - 1}`, "a".repeat(5000)),
      ),
    ];

    const rendered = simulateTurn(initial, 6);

    for (let r = 1; r < rendered.length; r++) {
      const previous = rendered[r - 1];
      const current = rendered[r];
      expect(current.length).toBeGreaterThan(previous.length);
      // Le préfixe commun doit être identique octet pour octet, hors points de
      // cache qui se déplacent par construction.
      const strip = (m: Message) => JSON.stringify(m).replaceAll(
        ',"cache_control":{"type":"ephemeral"}',
        "",
      );
      for (let i = 0; i < previous.length; i++) {
        expect(strip(current[i])).toBe(strip(previous[i]));
      }
    }
  });

  it("sans fenêtre figée, le préfixe change entre deux rounds", () => {
    // Contre-test : documente la régression que le cutoff figé corrige.
    const history: Message[] = [
      userText("question"),
      ...Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? assistantToolUse(`init${i}`, "query_database")
          : toolResult(`init${i - 1}`, "a".repeat(5000)),
      ),
    ];

    const before = compactForApi(history);
    history.push(assistantToolUse("next", "query_database"));
    history.push(toolResult("next", "b".repeat(5000)));
    const after = compactForApi(history);

    const changed = before.some((m, i) => JSON.stringify(m) !== JSON.stringify(after[i]));
    expect(changed).toBe(true);
  });
});

describe("withCacheBreakpoints", () => {
  it("marque le dernier bloc du dernier message", () => {
    const out = withCacheBreakpoints([userText("a"), toolResult("t0", "résultat")]);
    const blocks = out[1].content as Array<Record<string, unknown>>;
    expect(blocks[blocks.length - 1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("convertit un contenu texte en bloc pour porter le point de cache", () => {
    const out = withCacheBreakpoints([userText("question")]);
    expect(out[0].content).toEqual([
      { type: "text", text: "question", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("pose un second point en arrière pour la fenêtre de 20 blocs", () => {
    const messages: Message[] = Array.from({ length: 8 }, (_, i) =>
      toolResult(`t${i}`, `résultat ${i}`),
    );
    const out = withCacheBreakpoints(messages);
    const marked = out.filter((m) =>
      (m.content as Array<Record<string, unknown>>).some((b) => b.cache_control),
    );
    expect(marked).toHaveLength(2);
  });

  it("respecte le plafond de 4 points de cache de l'API", () => {
    const messages: Message[] = Array.from({ length: 30 }, (_, i) =>
      toolResult(`t${i}`, `résultat ${i}`),
    );
    const out = withCacheBreakpoints(messages);
    const count = out.reduce(
      (acc, m) =>
        acc +
        (m.content as Array<Record<string, unknown>>).filter((b) => b.cache_control).length,
      0,
    );
    // 2 ici + 1 sur le system dans agent-chat = 3, sous la limite de 4.
    expect(count).toBeLessThanOrEqual(3);
  });

  it("ne marque jamais un bloc thinking (il porte une signature)", () => {
    const messages: Message[] = [
      userText("a"),
      { role: "assistant", content: [{ type: "thinking", thinking: "...", signature: "sig" }] },
    ];
    const out = withCacheBreakpoints(messages);
    const blocks = out[1].content as Array<Record<string, unknown>>;
    expect(blocks[0].cache_control).toBeUndefined();
  });

  it("ne mute pas les messages d'origine", () => {
    const messages: Message[] = [userText("a"), toolResult("t0", "résultat")];
    withCacheBreakpoints(messages);
    const blocks = messages[1].content as Array<Record<string, unknown>>;
    expect(blocks[0].cache_control).toBeUndefined();
    expect(messages[0].content).toBe("a");
  });
});
