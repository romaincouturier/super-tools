import { describe, expect, it } from "vitest";
import {
  daysBetween,
  extensionInvoiceLine,
  extensionReference,
  suggestedExtensionStart,
  validateExtensionPeriod,
} from "./location-extension.ts";

describe("suggestedExtensionStart", () => {
  it("part de la fin de la dernière prolongation en priorité", () => {
    expect(
      suggestedExtensionStart({
        lastExtensionEnd: "2026-11-15",
        locationEndDate: "2026-10-14",
        orderDate: "2026-09-14T10:07:56+00:00",
        durationDays: 30,
      }),
    ).toBe("2026-11-15");
  });

  it("déduit la fin du contrat initial de la commande et de la durée du jeu", () => {
    expect(
      suggestedExtensionStart({
        lastExtensionEnd: null,
        locationEndDate: null,
        orderDate: "2026-09-14T10:07:56+00:00",
        durationDays: 30,
      }),
    ).toBe("2026-10-14");
  });

  it("reprend la fin de location connue quand aucune prolongation n'existe", () => {
    expect(
      suggestedExtensionStart({
        lastExtensionEnd: null,
        locationEndDate: "2026-10-20",
        orderDate: "2026-09-14",
        durationDays: 30,
      }),
    ).toBe("2026-10-20");
  });

  it("ne propose rien sans durée connue", () => {
    expect(
      suggestedExtensionStart({ lastExtensionEnd: null, locationEndDate: null, orderDate: "2026-09-14", durationDays: null }),
    ).toBeNull();
  });
});

describe("extension", () => {
  it("numérote l'avenant à partir du contrat d'origine", () => {
    expect(extensionReference("LOC-2026-001", 2)).toBe("LOC-2026-001-P2");
  });

  it("compte les jours sans glisser en changement d'heure", () => {
    expect(daysBetween("2026-10-14", "2026-11-15")).toBe(32);
  });

  it("refuse une période vide ou inversée", () => {
    expect(() => validateExtensionPeriod("2026-10-14", "2026-10-14")).toThrow(/postérieure/);
    expect(() => validateExtensionPeriod("", "2026-10-14")).toThrow("Date de début invalide (vide)");
    expect(() => validateExtensionPeriod("14/10/2026", "2026-10-14")).toThrow("Date de début invalide (14/10/2026)");
    expect(() => validateExtensionPeriod("2026-10-14", "")).toThrow("Date de fin invalide (vide)");
    expect(() => validateExtensionPeriod("2026-10-14", "15/11/2026")).toThrow("Date de fin invalide (15/11/2026)");
    expect(() => validateExtensionPeriod("2026-10-14", "2026-11-15")).not.toThrow();
  });

  it("décrit la période et l'avenant sur la ligne de facture", () => {
    expect(
      extensionInvoiceLine({
        gameTitle: "Deadline",
        reference: "LOC-2026-001-P1",
        start: "2026-10-14",
        end: "2026-11-15",
        amountHt: 29,
        vatRate: "FR_200",
      }),
    ).toEqual({
      label: "Prolongation de location : Deadline",
      description: "Du 14/10/2026 au 15/11/2026 · avenant LOC-2026-001-P1",
      quantity: 1,
      unit_price: 29,
      vat_rate: "FR_200",
    });
  });
});
