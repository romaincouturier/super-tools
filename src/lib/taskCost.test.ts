import { describe, it, expect } from "vitest";
import { summarizeTasks } from "./taskCost";
import type { ApiUsageTask } from "@/lib/supabase-rpc";

const task = (over: Partial<ApiUsageTask> = {}): ApiUsageTask => ({
  task_id: "t1",
  origin: "agent-chat",
  started_at: "2026-09-08T09:00:00Z",
  calls: 1,
  errors: 0,
  input_tokens: 1000,
  output_tokens: 200,
  cache_read_tokens: 0,
  cache_write_tokens: 0,
  cost_usd: 0.01,
  duration_ms: 1500,
  ...over,
});

describe("summarizeTasks", () => {
  it("rend un état neutre sans aucune tâche", () => {
    expect(summarizeTasks([])).toEqual({
      tasks: 0,
      succeeded: 0,
      failed: 0,
      avgCostPerSuccess: 0,
      maxCost: 0,
      avgCalls: 0,
      cacheRate: 0,
      wastedCost: 0,
    });
  });

  it("moyenne le coût sur les seules tâches abouties", () => {
    // La tâche en erreur a coûté de l'argent sans rendre de service : la
    // compter dans la moyenne ferait passer un échec pour une baisse de coût.
    const summary = summarizeTasks([
      task({ task_id: "a", cost_usd: 0.1 }),
      task({ task_id: "b", cost_usd: 0.3 }),
      task({ task_id: "c", cost_usd: 1, errors: 2 }),
    ]);

    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.avgCostPerSuccess).toBeCloseTo(0.2, 6);
    expect(summary.wastedCost).toBeCloseTo(1, 6);
  });

  it("rend zéro quand aucune tâche n'a abouti", () => {
    const summary = summarizeTasks([task({ cost_usd: 0.5, errors: 1 })]);

    expect(summary.avgCostPerSuccess).toBe(0);
    expect(summary.wastedCost).toBeCloseTo(0.5, 6);
  });

  it("retient la tâche la plus chère, même tombée en erreur", () => {
    const summary = summarizeTasks([
      task({ task_id: "a", cost_usd: 0.2 }),
      task({ task_id: "b", cost_usd: 0.9, errors: 1 }),
    ]);

    expect(summary.maxCost).toBeCloseTo(0.9, 6);
  });

  it("moyenne les appels par tâche, pas l'inverse", () => {
    const summary = summarizeTasks([
      task({ task_id: "a", calls: 7 }),
      task({ task_id: "b", calls: 3 }),
    ]);

    expect(summary.avgCalls).toBeCloseTo(5, 6);
  });

  it("calcule la part de l'entrée servie par le cache", () => {
    const summary = summarizeTasks([
      task({ task_id: "a", input_tokens: 1000, cache_read_tokens: 3000 }),
      task({ task_id: "b", input_tokens: 1000, cache_read_tokens: 5000 }),
    ]);

    expect(summary.cacheRate).toBeCloseTo(80, 6);
  });

  it("rend un taux de cache nul quand aucun token d'entrée n'est compté", () => {
    expect(summarizeTasks([task({ input_tokens: 0, cache_read_tokens: 0 })]).cacheRate).toBe(0);
  });

  it("accepte les nombres rendus en chaîne par PostgREST", () => {
    // Les numeric et bigint reviennent en chaîne : additionner sans convertir
    // produirait une concaténation, donc un coût absurde et silencieux.
    const summary = summarizeTasks([
      { ...task({ task_id: "a" }), cost_usd: "0.25" as unknown as number },
      { ...task({ task_id: "b" }), cost_usd: "0.75" as unknown as number },
    ]);

    expect(summary.avgCostPerSuccess).toBeCloseTo(0.5, 6);
    expect(summary.maxCost).toBeCloseTo(0.75, 6);
  });
});
