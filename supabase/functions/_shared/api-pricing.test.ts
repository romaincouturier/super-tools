import { describe, it, expect } from "vitest";
import {
  estimateCostUsd,
  normalizeModel,
  priceFor,
  ANTHROPIC_CACHE_READ_RATIO,
  ANTHROPIC_CACHE_WRITE_RATIO,
} from "./api-pricing.ts";

describe("normalizeModel", () => {
  it("retire le suffixe de date d'un identifiant daté", () => {
    expect(normalizeModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5");
  });

  it("laisse intact un identifiant sans date et ignore les espaces", () => {
    expect(normalizeModel("  claude-sonnet-5  ")).toBe("claude-sonnet-5");
  });

  it("ne confond pas une version numérique avec une date", () => {
    expect(normalizeModel("gpt-4o-mini")).toBe("gpt-4o-mini");
  });
});

describe("priceFor", () => {
  it("applique le tarif public de Sonnet 5", () => {
    // 2/10, et non 3/15 qui est celui de Sonnet 4.6. Confondre les deux
    // surestimait de 50 % le coût de agent-chat, principal poste de dépense.
    expect(priceFor("anthropic", "claude-sonnet-5")).toEqual({ input: 2, output: 10 });
    expect(priceFor("anthropic", "claude-sonnet-4-6")).toEqual({ input: 3, output: 15 });
  });

  it("route gemini vers la table de la gateway Lovable", () => {
    expect(priceFor("gemini", "google/gemini-2.5-flash")).toEqual({ input: 0.3, output: 2.5 });
    expect(priceFor("lovable", "google/gemini-2.5-pro")).toEqual({ input: 1.25, output: 10 });
  });

  it("rend null pour un modèle absent de la table", () => {
    expect(priceFor("anthropic", "claude-inexistant")).toBeNull();
    expect(priceFor("openai", "")).toBeNull();
  });

  it("rend null pour un provider facturé autrement qu'au token", () => {
    expect(priceFor("assemblyai", "universal")).toBeNull();
  });

  it("rend null pour un modèle absent de la table de la gateway", () => {
    expect(priceFor("lovable", "google/gemini-inexistant")).toBeNull();
  });
});

describe("estimateCostUsd", () => {
  it("respecte un coût imposé par l'appelant", () => {
    expect(estimateCostUsd({ provider: "anthropic", costUsd: 0.42, inputTokens: 1e9 })).toBe(0.42);
  });

  it("facture AssemblyAI à la durée d'audio", () => {
    expect(estimateCostUsd({ provider: "assemblyai", audioSeconds: 3600 })).toBeCloseTo(0.27, 6);
    expect(estimateCostUsd({ provider: "assemblyai" })).toBe(0);
  });

  it("additionne entrée et sortie au tarif du modèle", () => {
    const cost = estimateCostUsd({
      provider: "anthropic",
      model: "claude-sonnet-5",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(12, 6);
  });

  it("facture une lecture de cache au dixième du prix d'entrée", () => {
    const cost = estimateCostUsd({
      provider: "anthropic",
      model: "claude-sonnet-5",
      cacheReadTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(2 * ANTHROPIC_CACHE_READ_RATIO, 6);
  });

  it("facture une écriture de cache plus cher qu'un token d'entrée", () => {
    // Une écriture jamais relue coûte 25 % de plus que pas de cache du tout :
    // c'est ce qui rend le cache perdant sur un appel unique.
    const cost = estimateCostUsd({
      provider: "anthropic",
      model: "claude-sonnet-5",
      cacheWriteTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(2 * ANTHROPIC_CACHE_WRITE_RATIO, 6);
    expect(ANTHROPIC_CACHE_WRITE_RATIO).toBeGreaterThan(1);
  });

  it("accepte un identifiant daté sans perdre le tarif", () => {
    const cost = estimateCostUsd({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      inputTokens: 1_000_000,
    });

    expect(cost).toBeCloseTo(1, 6);
  });

  it("rend zéro plutôt que d'inventer un tarif pour un modèle inconnu", () => {
    const cost = estimateCostUsd({
      provider: "anthropic",
      model: "claude-inexistant",
      inputTokens: 1_000_000,
    });

    expect(cost).toBe(0);
  });

  it("rend zéro quand aucun token n'est fourni", () => {
    expect(estimateCostUsd({ provider: "openai", model: "gpt-4o" })).toBe(0);
  });

  it("rend zéro quand le modèle n'est pas renseigné", () => {
    expect(estimateCostUsd({ provider: "anthropic", inputTokens: 1_000_000 })).toBe(0);
  });
});
