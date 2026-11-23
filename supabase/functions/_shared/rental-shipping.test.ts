import { describe, it, expect } from "vitest";
import { rentalShippingState, parseNotifyEmails, formatShippingAddress } from "./rental-shipping";

const now = new Date("2026-11-23T10:00:00Z");
describe("rentalShippingState", () => {
  it("pending envoyé = ne pas expédier, avec âge et relances", () => {
    const s = rentalShippingState({ status: "pending", email_sent_at: "2026-11-20T10:00:00Z", expires_at: "2026-12-20T00:00:00Z", reminder_count: 1 }, {}, now);
    expect(s).toMatchObject({ kind: "wait", ageDays: 3, reminders: 1 });
  });
  it("signé non expédié = colis à préparer", () => {
    expect(rentalShippingState({ status: "signed", signed_at: "2026-11-21T09:00:00Z" }, {}, now)).toMatchObject({ kind: "prepare", signedAt: "2026-11-21T09:00:00Z" });
  });
  it("pending dépassé = expiré", () => {
    expect(rentalShippingState({ status: "pending", email_sent_at: "2026-10-01", expires_at: "2026-11-01" }, {}, now)).toMatchObject({ kind: "invalid", reason: "expiré" });
  });
  it("annulé = invalide", () => {
    expect(rentalShippingState({ status: "cancelled" }, {}, now)).toMatchObject({ kind: "invalid", reason: "annulé" });
  });
  it("expédié ou remis = terminé", () => {
    expect(rentalShippingState({ status: "signed" }, { shipped_confirmed_at: "2026-11-22" }, now).kind).toBe("done");
    expect(rentalShippingState({ status: "signed" }, { hand_delivered_at: "2026-11-22" }, now).kind).toBe("done");
  });
});
describe("parseNotifyEmails", () => {
  it("lit le réglage sans adresse codée en dur", () => {
    expect(parseNotifyEmails("A@x.fr, b@y.fr;a@x.fr, pasunemail")).toEqual(["a@x.fr", "b@y.fr"]);
    expect(parseNotifyEmails("")).toEqual([]);
    expect(parseNotifyEmails(null)).toEqual([]);
  });
});
it("formate l'adresse de livraison", () => {
  expect(formatShippingAddress({ first_name: "Laura", last_name: "S", address_1: "1 rue", postcode: "75001", city: "Paris" })).toBe("Laura S, 1 rue, 75001 Paris");
});
