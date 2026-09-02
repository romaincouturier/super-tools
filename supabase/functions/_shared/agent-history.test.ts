import { describe, it, expect } from "vitest";
import {
  withCacheBreakpoints,
  stripThinking,
  type Message,
} from "./agent-history.ts";

function userText(text: string): Message {
  return { role: "user", content: text };
}

function assistantToolUse(id: string, name: string): Message {
  return {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "...", signature: `sig-${id}` },
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
  const rendered: Message[][] = [];

  for (let r = 0; r < rounds; r++) {
    rendered.push(withCacheBreakpoints(history));
    history.push(assistantToolUse(`t${r}`, "query_database"));
    history.push(toolResult(`t${r}`, "x".repeat(5000)));
  }
  return rendered;
}

describe("historique append-only", () => {
  it("le préfixe déjà rendu ne change plus d'un round à l'autre", () => {
    // L'invariant qui conditionne le prompt caching et la validité des blocs
    // thinking : la signature d'un bloc scelle tout ce qui le précède, donc
    // réécrire un tour déjà envoyé invalide tous les blocs postérieurs.
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

  it("un nouveau tour utilisateur ne retouche pas les tours précédents", () => {
    // Le rabotage des tool_results se faisait ici et retronquait, à chaque
    // nouveau tour, des messages envoyés entiers au tour d'avant. Il est passé
    // au context editing serveur, qui ne compte pas comme une édition.
    const history: Message[] = [
      userText("question"),
      ...Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? assistantToolUse(`init${i}`, "query_database")
          : toolResult(`init${i - 1}`, "a".repeat(5000)),
      ),
    ];
    const before = history.map((m) => JSON.stringify(m));

    history.push(userText("nouvelle question"));

    expect(history.slice(0, before.length).map((m) => JSON.stringify(m))).toEqual(before);
  });
});

describe("stripThinking", () => {
  it("retire les blocs thinking et redacted_thinking", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "...", signature: "sig" },
          { type: "redacted_thinking", data: "opaque" },
          { type: "text", text: "réponse" },
          { type: "tool_use", id: "t0", name: "query_database", input: {} },
        ],
      },
    ];

    const out = stripThinking(messages);
    expect(out[0].content).toEqual([
      { type: "text", text: "réponse" },
      { type: "tool_use", id: "t0", name: "query_database", input: {} },
    ]);
  });

  it("laisse intact un message sans bloc thinking", () => {
    const messages: Message[] = [userText("question"), toolResult("t0", "résultat")];
    const out = stripThinking(messages);
    expect(out[0]).toBe(messages[0]);
    expect(out[1]).toBe(messages[1]);
  });

  it("ne mute pas les messages d'origine", () => {
    const messages: Message[] = [assistantToolUse("t0", "query_database")];
    stripThinking(messages);
    expect((messages[0].content as unknown[]).length).toBe(3);
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
