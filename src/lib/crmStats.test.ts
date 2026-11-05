import { describe, expect, it } from "vitest";
import { columnAtDay } from "./kanbanColumnAtDay";
import type { KanbanStatsItem } from "@/types/kanban";
import { crmStatsItem } from "./crmStats";

const today = new Date("2026-11-04T23:59:59Z");
const currentItem = (columnId: string): KanbanStatsItem & { currentColumnAsOf: string } => ({
  id: "card", columnId, createdAt: "2026-10-01T10:00:00Z",
  currentColumnAsOf: "2026-11-04T00:00:00Z",
  moves: [{ at: "2026-10-02T10:00:00Z", from: "entrant", to: "devis" }],
});

describe("statistiques CRM au jour courant", () => {
  const card = {
    id: "card", sales_status: "OPEN" as const, column_id: "devis",
    created_at: "2026-10-01T10:00:00Z", won_at: null, lost_at: null, estimated_value: 150,
  };
  it("classe toutes les perdues par statut, même dans Devis envoyé", () => {
    expect(crmStatsItem({ ...card, sales_status: "LOST" }, [], today).columnId).toBe("__stats_lost__");
  });
  it("classe uniquement les gagnées dans Gagné, même dans Entrant", () => {
    expect(crmStatsItem({ ...card, sales_status: "WON", column_id: "entrant" }, [], today).columnId).toBe("__stats_won__");
  });
  for (const column of ["entrant", "contacte", "devis"]) {
    it(`garde uniquement les non gagnées/non perdues dans ${column}`, () => {
      const result = crmStatsItem({ ...card, column_id: column, won_at: "2026-10-10T00:00:00Z" }, [], today);
      expect(result.columnId).toBe(column);
      expect(result.completedAt).toBeNull();
    });
  }
  it("utilise la date de perte pour une perdue précédemment gagnée", () => {
    expect(crmStatsItem({ ...card, sales_status: "LOST", won_at: "2026-10-10", lost_at: "2026-10-20" }, [], today).completedAt).toBe("2026-10-20");
  });
  it("compte une gagnée sans date de clôture uniquement dans Gagné", () => {
    expect(columnAtDay(currentItem("__stats_won__"), today, "entrant")).toBe("__stats_won__");
  });
  it("compte une perdue sans date de clôture uniquement dans Perdu", () => {
    expect(columnAtDay(currentItem("__stats_lost__"), today, "entrant")).toBe("__stats_lost__");
  });
  for (const column of ["entrant", "contacte", "devis"]) {
    it(`compte une ouverte dans sa colonne actuelle ${column}, pas dans son ancien historique`, () => {
      expect(columnAtDay(currentItem(column), today, "entrant")).toBe(column);
    });
  }
  it("conserve le rejeu de l’historique pour les jours précédents", () => {
    expect(columnAtDay(currentItem("__stats_won__"), new Date("2026-11-03T23:59:59Z"), "entrant")).toBe("devis");
  });
});