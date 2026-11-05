import { describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_SORTS, sortTrainings } from "./trainingSorting";

const rows = [
  { training_name: "Zèbre", client_name: "Alpha", location: "Paris", participant_count: 214, start_date: "2026-11-10", created_at: "2026-01-01" },
  { training_name: "Agilité", client_name: "Zeta", location: "Lyon", participant_count: 9, start_date: "2026-11-04", created_at: "2026-01-01" },
];
describe("Tri des formations", () => {
  it.each(["upcoming", "ongoing"] as const)("%s est chronologique par défaut", (tab) => {
    expect(sortTrainings(rows, DEFAULT_TRAINING_SORTS[tab]).map(r => r.start_date)).toEqual(["2026-11-04", "2026-11-10"]);
  });
  it("les permanentes sont alphabétiques par défaut", () => {
    expect(sortTrainings(rows, DEFAULT_TRAINING_SORTS.permanent).map(r => r.training_name)).toEqual(["Agilité", "Zèbre"]);
  });
  it("trie les inscrits numériquement dans les deux sens", () => {
    expect(sortTrainings(rows, { field: "participant_count", order: "desc" }).map(r => r.participant_count)).toEqual([214, 9]);
    expect(sortTrainings(rows, { field: "participant_count", order: "asc" }).map(r => r.participant_count)).toEqual([9, 214]);
  });
  it.each(["client", "location", "title"] as const)("trie %s alphabétiquement et inverse le tri", (field) => {
    const key = field === "client" ? "client_name" : field === "location" ? "location" : "training_name";
    const expected = field === "client" ? ["Alpha", "Zeta"] : field === "location" ? ["Lyon", "Paris"] : ["Agilité", "Zèbre"];
    expect(sortTrainings(rows, { field, order: "asc" }).map(r => r[key])).toEqual(expected);
    expect(sortTrainings(rows, { field, order: "desc" }).map(r => r[key])).toEqual([...expected].reverse());
  });
  it("garde les sessions sans date en tête du tri chronologique sans muter les données", () => {
    const input = [...rows, { ...rows[0], start_date: null }];
    expect(sortTrainings(input, DEFAULT_TRAINING_SORTS.upcoming)[0].start_date).toBeNull();
    expect(input[0].start_date).toBe("2026-11-10");
  });
});