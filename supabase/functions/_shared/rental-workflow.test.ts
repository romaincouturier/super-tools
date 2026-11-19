import { describe, expect, it, vi } from "vitest";
import { prepareRentalContract, rentalSignaturePatch, type RentalState } from "./rental-workflow";

const state: RentalState = { game_type: "location", kanban_status: "location_pending", location_contract_file_url: null, email_sent_at: null, archived_at: null, signed: false };

describe("Parcours du contrat de location", () => {
  it("passe en location en cours après signature et retire le blocage", () => {
    expect(rentalSignaturePatch("2026-11-19T10:00:00Z")).toEqual({ kanban_status: "location_active", location_end_date: "2026-12-19", block_reason: null });
  });
  it("génère avant d'envoyer le contrat de location", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    expect(await prepareRentalContract(state, true, invoke)).toBe(true);
    expect(invoke.mock.calls).toEqual([["generate-location-contract"], ["send-location-contract-email"]]);
  });
  it("génère même si les emails automatiques sont désactivés", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    expect(await prepareRentalContract(state, false, invoke)).toBe(false);
    expect(invoke.mock.calls).toEqual([["generate-location-contract"]]);
  });
  it("ne renvoie pas un contrat déjà envoyé", async () => {
    const invoke = vi.fn();
    expect(await prepareRentalContract({ ...state, location_contract_file_url: "pdf", email_sent_at: "2026-11-19" }, true, invoke)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("ne traite pas une location déjà signée", async () => {
    const invoke = vi.fn();
    expect(await prepareRentalContract({ ...state, signed: true }, true, invoke)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("ne traite pas une carte archivée", async () => {
    const invoke = vi.fn();
    expect(await prepareRentalContract({ ...state, archived_at: "2026-11-19" }, true, invoke)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("ne traite pas une vente", async () => {
    const invoke = vi.fn();
    expect(await prepareRentalContract({ ...state, game_type: "supertilt" }, true, invoke)).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it("n'envoie rien si la génération échoue", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("PDF indisponible"));
    await expect(prepareRentalContract(state, true, invoke)).rejects.toThrow("PDF indisponible");
    expect(invoke.mock.calls).toEqual([["generate-location-contract"]]);
  });
});