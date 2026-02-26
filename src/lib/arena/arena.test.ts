import { describe, it, expect } from "vitest";
import { estimateCost, MODEL_COSTS, AGENT_COLORS } from "./types";
import { searchExperts, EXPERT_POOL } from "./experts";
import { buildSlidingContext, createDefaultAgent } from "./store";
import { exportToMarkdown } from "./export";
import type { Message, SessionConfig, SessionResult } from "./types";

// ═══════════════════════════════════════════════════════════════════════
// estimateCost
// ═══════════════════════════════════════════════════════════════════════

describe("estimateCost", () => {
  // ── Cas nominaux ───────────────────────────────────────────

  it("calculates cost for Claude Sonnet correctly", () => {
    // 1000 input tokens at $3/1M + 500 output tokens at $15/1M
    const cost = estimateCost("claude-sonnet-4-5-20250929", 1000, 500);
    expect(cost).toBeCloseTo(0.003 + 0.0075, 6);
  });

  it("calculates cost for GPT-4o Mini (cheapest model)", () => {
    const cost = estimateCost("gpt-4o-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.15 + 0.6, 4);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCost("gpt-4o", 0, 0)).toBe(0);
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("returns 0 for unknown model", () => {
    expect(estimateCost("unknown-model-v99", 1000, 500)).toBe(0);
  });

  it("handles very large token counts", () => {
    const cost = estimateCost("gpt-4o", 10_000_000, 5_000_000);
    // 10M * 2.5/1M + 5M * 10/1M = 25 + 50 = 75
    expect(cost).toBeCloseTo(75, 2);
  });

  it("computes all known models without error", () => {
    for (const model of Object.keys(MODEL_COSTS)) {
      const cost = estimateCost(model, 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// searchExperts
// ═══════════════════════════════════════════════════════════════════════

describe("searchExperts", () => {
  // ── Cas nominaux ───────────────────────────────────────────

  it("finds expert by name", () => {
    const results = searchExperts("CTO");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("cto");
  });

  it("finds experts by domain", () => {
    const results = searchExperts("tech");
    expect(results.length).toBeGreaterThanOrEqual(3);
    // All domain:"tech" experts should be in the results
    const techExperts = EXPERT_POOL.filter((e) => e.domain === "tech");
    for (const expert of techExperts) {
      expect(results.map((r) => r.id)).toContain(expert.id);
    }
  });

  it("finds expert by tag", () => {
    const results = searchExperts("rgpd");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const ids = results.map((r) => r.id);
    expect(ids).toContain("juriste");
  });

  it("finds expert by expertise keyword", () => {
    const results = searchExperts("kubernetes");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("sre");
  });

  it("is case insensitive", () => {
    const upper = searchExperts("CEO");
    const lower = searchExperts("ceo");
    expect(upper.length).toBe(lower.length);
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("returns empty array for non-matching query", () => {
    expect(searchExperts("zzzznoexpert")).toEqual([]);
  });

  it("returns all experts for very generic query", () => {
    // All experts have text somewhere
    const results = searchExperts("e");
    expect(results.length).toBeGreaterThan(10);
  });

  it("handles empty query (returns all)", () => {
    const results = searchExperts("");
    expect(results.length).toBe(EXPERT_POOL.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// buildSlidingContext
// ═══════════════════════════════════════════════════════════════════════

describe("buildSlidingContext", () => {
  const makeMsg = (i: number, isUser = false): Message => ({
    id: `msg-${i}`,
    agentId: `agent-${i % 3}`,
    agentName: `Agent ${i % 3}`,
    agentColor: "#000",
    content: `Message content ${i}`,
    turnNumber: i,
    timestamp: Date.now(),
    isUser,
  });

  // ── Cas nominaux ───────────────────────────────────────────

  it("returns all messages when under the limit", () => {
    const messages = Array.from({ length: 5 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 10);
    expect(result).toHaveLength(5);
  });

  it("returns exactly maxMessages + 1 (summary) when over the limit", () => {
    const messages = Array.from({ length: 30 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 20);
    // 1 summary + 20 kept
    expect(result).toHaveLength(21);
  });

  it("summary contains skipped agent messages", () => {
    const messages = Array.from({ length: 30 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 20);
    expect(result[0].agentName).toBe("Systeme");
    expect(result[0].content).toContain("Resume des");
    expect(result[0].content).toContain("10 messages precedents");
  });

  it("keeps the last N messages in order", () => {
    const messages = Array.from({ length: 30 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 20);
    const kept = result.slice(1);
    // Should be messages 10-29
    expect(kept[0].content).toContain("Message content 10");
    expect(kept[kept.length - 1].content).toContain("Message content 29");
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("handles empty messages array", () => {
    expect(buildSlidingContext([], 20)).toEqual([]);
  });

  it("handles exactly maxMessages messages (no trimming)", () => {
    const messages = Array.from({ length: 20 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 20);
    expect(result).toHaveLength(20);
  });

  it("handles maxMessages + 1 (minimal trimming)", () => {
    const messages = Array.from({ length: 21 }, (_, i) => makeMsg(i));
    const result = buildSlidingContext(messages, 20);
    expect(result).toHaveLength(21); // 1 summary + 20 kept
    expect(result[0].agentName).toBe("Systeme");
  });

  it("excludes user messages from summary points", () => {
    // First 5 are user messages, next 25 are agent messages
    const messages = [
      ...Array.from({ length: 5 }, (_, i) => makeMsg(i, true)),
      ...Array.from({ length: 25 }, (_, i) => makeMsg(i + 5)),
    ];
    const result = buildSlidingContext(messages, 20);
    const summary = result[0].content;
    // 10 skipped messages total (5 user + 5 agent), summary should only have agent lines
    expect(summary).not.toContain("Utilisateur");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// createDefaultAgent
// ═══════════════════════════════════════════════════════════════════════

describe("createDefaultAgent", () => {
  it("creates agent with correct name from index", () => {
    const agent = createDefaultAgent(0);
    expect(agent.name).toBe("Agent 1");
    expect(agent.provider).toBe("claude");
    expect(agent.model).toBe("claude-haiku-4-5-20251001");
  });

  it("assigns colors cyclically", () => {
    const a0 = createDefaultAgent(0);
    const a1 = createDefaultAgent(1);
    const a6 = createDefaultAgent(6); // same as 0 (6 colors)
    expect(a0.color).toBe(AGENT_COLORS[0]);
    expect(a1.color).toBe(AGENT_COLORS[1]);
    expect(a6.color).toBe(AGENT_COLORS[0]);
  });

  it("generates unique IDs", () => {
    const agents = Array.from({ length: 10 }, (_, i) => createDefaultAgent(i));
    const ids = new Set(agents.map((a) => a.id));
    expect(ids.size).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// exportToMarkdown
// ═══════════════════════════════════════════════════════════════════════

describe("exportToMarkdown", () => {
  const minimalConfig: SessionConfig = {
    topic: "Test topic",
    mode: "exploration",
    userMode: "observer",
    agents: [
      {
        id: "a1",
        name: "Agent A",
        provider: "claude",
        model: "claude-haiku-4-5-20251001",
        role: "Expert",
        personality: "Calm",
        color: "#3B82F6",
      },
    ],
    rules: { maxTurns: 5, maxTokensPerTurn: 500, language: "Français" },
  };

  const minimalResult: SessionResult = {
    messages: [
      {
        id: "m1",
        agentId: "a1",
        agentName: "Agent A",
        agentColor: "#3B82F6",
        content: "Hello world",
        turnNumber: 1,
        timestamp: Date.now(),
      },
    ],
    synthesis: "A great synthesis",
    keyPoints: ["Point 1", "Point 2"],
    metrics: {
      totalTurns: 1,
      tokensPerAgent: { a1: 100 },
      totalTokens: 100,
      totalInputTokens: 50,
      estimatedCost: 0.001,
      duration: 5000,
    },
  };

  // ── Cas nominaux ───────────────────────────────────────────

  it("generates valid markdown with all sections", () => {
    const md = exportToMarkdown(minimalConfig, minimalResult);
    expect(md).toContain("# AI Arena - Transcript de discussion");
    expect(md).toContain("## Sujet");
    expect(md).toContain("Test topic");
    expect(md).toContain("## Configuration");
    expect(md).toContain("**Agent A**");
    expect(md).toContain("## Discussion");
    expect(md).toContain("Hello world");
    expect(md).toContain("## Synthese");
    expect(md).toContain("A great synthesis");
    expect(md).toContain("## Points cles");
    expect(md).toContain("- Point 1");
    expect(md).toContain("## Metriques");
  });

  it("includes additional context when provided", () => {
    const config = { ...minimalConfig, additionalContext: "Extra context here" };
    const md = exportToMarkdown(config, minimalResult);
    expect(md).toContain("## Contexte additionnel");
    expect(md).toContain("Extra context here");
  });

  it("skips additional context section when not provided", () => {
    const md = exportToMarkdown(minimalConfig, minimalResult);
    expect(md).not.toContain("## Contexte additionnel");
  });

  it("handles synthesis messages correctly", () => {
    const result = {
      ...minimalResult,
      messages: [
        { ...minimalResult.messages[0], isSynthesis: true, content: "Synthesis content" },
      ],
    };
    const md = exportToMarkdown(minimalConfig, result);
    expect(md).toContain("### Synthese");
    expect(md).toContain("Synthesis content");
  });

  it("handles deliverable messages", () => {
    const result = {
      ...minimalResult,
      messages: [
        { ...minimalResult.messages[0], isDeliverable: true, content: "Deliverable content" },
      ],
      deliverable: "Final deliverable",
    };
    const md = exportToMarkdown(minimalConfig, result);
    expect(md).toContain("### Livrable final");
    expect(md).toContain("## Livrable");
    expect(md).toContain("Final deliverable");
  });

  it("handles vote messages and results", () => {
    const result = {
      ...minimalResult,
      messages: [
        { ...minimalResult.messages[0], isVote: true, content: "I vote yes" },
      ],
      votes: [{ agentId: "a1", agentName: "Agent A", vote: "yes", reasoning: "Because..." }],
    };
    const md = exportToMarkdown(minimalConfig, result);
    expect(md).toContain("— VOTE");
    expect(md).toContain("## Resultats du vote");
    expect(md).toContain("Because...");
  });

  it("handles user messages", () => {
    const result = {
      ...minimalResult,
      messages: [
        { ...minimalResult.messages[0], isUser: true, content: "User input" },
      ],
    };
    const md = exportToMarkdown(minimalConfig, result);
    expect(md).toContain("[Utilisateur]");
    expect(md).toContain("User input");
  });

  // ── Cas aux limites ────────────────────────────────────────

  it("handles empty key points (no Points cles section)", () => {
    const result = { ...minimalResult, keyPoints: [] };
    const md = exportToMarkdown(minimalConfig, result);
    // "Points cles" section should not appear since there are none
    expect(md).not.toContain("## Points cles");
    // But metrics section should still be there
    expect(md).toContain("## Metriques");
  });

  it("handles multiple agents in configuration", () => {
    const config = {
      ...minimalConfig,
      agents: [
        ...minimalConfig.agents,
        {
          id: "a2",
          name: "Agent B",
          provider: "openai" as const,
          model: "gpt-4o",
          role: "Critic",
          personality: "Sharp",
          stance: "contre" as const,
          color: "#EF4444",
        },
      ],
    };
    const md = exportToMarkdown(config, minimalResult);
    expect(md).toContain("**Agent A**");
    expect(md).toContain("**Agent B**");
    expect(md).toContain("Position : contre");
  });

  it("formats metrics correctly", () => {
    const md = exportToMarkdown(minimalConfig, minimalResult);
    expect(md).toContain("**Tours total** : 1");
    expect(md).toContain("**Tokens sortie** : 100");
    expect(md).toContain("**Tokens entree** : 50");
    expect(md).toContain("**Cout estime** : $0.0010");
    expect(md).toContain("**Duree** : 5s");
  });
});
