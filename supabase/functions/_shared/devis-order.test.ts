import { describe, expect, it } from "vitest";
import { canCancelDevisOrder, devisLineTotal, devisOrderTotals, devisRoyalty, devisSaleKey, kanbanStatusForGameType } from "./devis-order";

describe("commandes issues d'un devis", () => {
  it("range chaque type de jeu dans la même colonne qu'une commande boutique", () => {
    expect(kanbanStatusForGameType("supertilt")).toBe("to_ship");
    expect(kanbanStatusForGameType("dropshipping")).toBe("dropshipping");
    expect(kanbanStatusForGameType("location")).toBe("location_pending");
    expect(kanbanStatusForGameType("partner")).toBe("received");
  });

  it("applique la remise par ligne", () => {
    expect(devisLineTotal({ quantity: 5, unitPrice: 30, discountPercent: 10 })).toBe(135);
    expect(() => devisLineTotal({ quantity: 0, unitPrice: 30 })).toThrow();
    expect(() => devisLineTotal({ quantity: 1, unitPrice: 30, discountPercent: 120 })).toThrow();
  });

  it("inclut port et frais de dossier dans les totaux", () => {
    expect(devisOrderTotals([135], 15, 0, 0.2)).toEqual({ totalHt: 150, totalTax: 30, totalTtc: 180 });
  });

  it("calcule les royalties comme le webhook", () => {
    expect(devisRoyalty({ commission_type: "percentage", commission_rate: 0.15, commission_fixed: null }, 1200, 1)).toBe(180);
    expect(devisRoyalty({ commission_type: "fixed", commission_rate: null, commission_fixed: 4 }, 100, 5)).toBe(20);
  });

  it("produit des clés de vente distinctes des numéros boutique", () => {
    expect(devisSaleKey("DV-2026-0001", 0)).toBe("DV-2026-0001-L1");
  });

  it("refuse l'annulation après expédition, remise ou contrat", () => {
    expect(canCancelDevisOrder([{ shipped_confirmed_at: null, hand_delivered_at: null }])).toBe(true);
    expect(canCancelDevisOrder([{ shipped_confirmed_at: "2026-11-06", hand_delivered_at: null }])).toBe(false);
    expect(canCancelDevisOrder([{ shipped_confirmed_at: null, hand_delivered_at: null, contrat_reference: "LOC-1" }])).toBe(false);
  });
});
