import type { ApiUsageTask } from "@/lib/supabase-rpc";

/**
 * Coût par tâche aboutie.
 *
 * Un agent renvoie tout son contexte à chaque tour de boucle : une question
 * produit plusieurs appels facturés. Le coût par appel baisse quand on découpe
 * davantage, ce qui est l'inverse de ce qu'on veut mesurer. La tâche est
 * l'unité utile, et seules les tâches abouties comptent : une tâche tombée en
 * erreur a coûté de l'argent sans rendre de service, elle se compte à part.
 */

export interface TaskCostSummary {
  tasks: number;
  succeeded: number;
  failed: number;
  /** Coût moyen d'une tâche qui a abouti. */
  avgCostPerSuccess: number;
  /** Coût de la tâche la plus chère, aboutie ou non. */
  maxCost: number;
  /** Appels facturés par tâche : le nombre de tours de boucle, en moyenne. */
  avgCalls: number;
  /** Part de l'entrée servie par le cache, en pourcentage. */
  cacheRate: number;
  /** Coût cumulé des tâches qui n'ont pas abouti. */
  wastedCost: number;
}

const EMPTY: TaskCostSummary = {
  tasks: 0,
  succeeded: 0,
  failed: 0,
  avgCostPerSuccess: 0,
  maxCost: 0,
  avgCalls: 0,
  cacheRate: 0,
  wastedCost: 0,
};

export function summarizeTasks(tasks: ApiUsageTask[]): TaskCostSummary {
  if (tasks.length === 0) return EMPTY;

  const succeeded = tasks.filter((t) => Number(t.errors) === 0);
  const failed = tasks.length - succeeded.length;

  const sumCost = (rows: ApiUsageTask[]) => rows.reduce((acc, t) => acc + Number(t.cost_usd), 0);
  const cacheRead = tasks.reduce((acc, t) => acc + Number(t.cache_read_tokens), 0);
  const fresh = tasks.reduce((acc, t) => acc + Number(t.input_tokens), 0);

  return {
    tasks: tasks.length,
    succeeded: succeeded.length,
    failed,
    avgCostPerSuccess: succeeded.length > 0 ? sumCost(succeeded) / succeeded.length : 0,
    maxCost: Math.max(...tasks.map((t) => Number(t.cost_usd))),
    avgCalls: tasks.reduce((acc, t) => acc + Number(t.calls), 0) / tasks.length,
    cacheRate: cacheRead + fresh > 0 ? (cacheRead / (cacheRead + fresh)) * 100 : 0,
    wastedCost: sumCost(tasks) - sumCost(succeeded),
  };
}
