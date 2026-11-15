import { describe, it, expect } from "vitest";
import {
  sanitizeForm, missingForSubmit, fileKindAllowed, formatCommission, buildContractPayload,
  otpSendRefusal, otpCheckRefusal, reminderDue, authorPostalAddress, invitationGameTitle, invitationGameName, authorSirenError,
} from "./author-onboarding";

const complete = () => sanitizeForm({
  legal_name: "Lean SAS", postal_address: "1 rue X", postal_code: "75001", city: "Paris", siren: "540035854", legal_rep_first_name: "Édouard", legal_rep_last_name: "Vuillemin",
  phone: "0600000000", game_name: "Lean TPS", author_email: "e@x.fr", pitch: "p", price_ht: "1 200",
  long_description: "d", credits: "c", weight_g: 4000, package_dimensions: "50x40x20", shipping_fee: 25, shipping_delay: "3 jours",
  game_page_url: "https://x.fr",
});
const files = [{ kind: "logo" }, { kind: "photo" }];

describe("author onboarding", () => {
  it("drops unknown fields and unsafe urls", () => {
    const f = sanitizeForm({ evil: "x", video_url: "javascript:alert(1)", price_ht: "1 200,5" });
    expect("evil" in f).toBe(false);
    expect(f.video_url).toBeNull();
    expect(f.price_ht).toBe(1200.5);
  });
  it("complete form is submittable", () => {
    expect(missingForSubmit(complete(), files)).toEqual([]);
  });
  it("location requires its four values when checked", () => {
    const f = { ...complete(), location_enabled: true };
    expect(missingForSubmit(f, files)).toHaveLength(3);
  });
  it.each([null, "", "   "])("allows an optional empty SIREN: %s", (siren) => {
    expect(missingForSubmit(sanitizeForm({ ...complete(), siren }), files)).toEqual([]);
  });
  it("rejects the reported invalid Luhn key", () => {
    expect(authorSirenError("123456689")).toContain("clé de contrôle incorrecte");
    expect(missingForSubmit({ ...complete(), siren: "123456689" }, files)).toHaveLength(1);
  });
  it.each(["54003585", "5400358540", "54003585A", "540-035-854"])("rejects malformed SIREN %s", (siren) => {
    expect(authorSirenError(siren)).toContain("exactement 9 chiffres");
  });
  it("accepts a valid Luhn key and removes spaces", () => {
    const f = sanitizeForm({ ...complete(), siren: " 540 035\u00a0854 " });
    expect(f.siren).toBe("540035854");
    expect(authorSirenError(f.siren)).toBeNull();
    expect(missingForSubmit(f, files)).toEqual([]);
  });
  it.each(["55 chemin du Moulin du Got, 69340 Francheville", "55 chemin du Moulin du Got\n69340 FRANCHEVILLE", "55 chemin du Moulin du Got, 69340", "55 chemin du Moulin du Got"])("deduplicates contract address from %s", (postal_address) => {
    const f = { ...complete(), postal_address, postal_code: "69340", city: "Francheville" };
    expect(buildContractPayload({ reference: "DIST-2026-002", form: f, commissionRate: 0.15, date: new Date(), distributorSignature: "" }).ADRESSE).toBe("55 chemin du Moulin du Got\n69340 Francheville");
  });
  it("preserves street names containing a city or postcode", () => {
    expect(authorPostalAddress({ postal_address: "1 rue de Paris", postal_code: "75001", city: "Paris" })).toBe("1 rue de\n75001 Paris");
  });
  it("requires separate postal code and city and keeps them in the contract address", () => {
    expect(missingForSubmit({ ...complete(), postal_code: null, city: null }, files)).toEqual(["Code postal", "Ville"]);
    expect(authorPostalAddress(complete())).toBe("1 rue X\n75001 Paris");
  });
  it("uses 30 renewable days for rentals even if a different duration is submitted", () => {
    const f = sanitizeForm({ ...complete(), location_enabled: true, location_duration_days: 90 });
    expect(f.location_duration_days).toBe(30);
    expect(buildContractPayload({ reference: "TEST", form: f, commissionRate: 0.15, date: new Date(), distributorSignature: "" }).LOCATION_DUREE).toBe("30 jours renouvelables");
  });
  it("rental-only does not require a selling price", () => {
    const f = sanitizeForm({ ...complete(), sale_enabled: false, price_ht: null, location_enabled: true,
      location_price_ht: 100, location_late_fee_month: 20, location_replacement_price: 1200 });
    expect(missingForSubmit(f, files)).toEqual([]);
  });
  it("requires a price only when selling and at least one distribution mode", () => {
    expect(missingForSubmit({ ...complete(), price_ht: null }, files)).toContain("Prix de vente HT");
    expect(missingForSubmit({ ...complete(), sale_enabled: false, location_enabled: false }, files)).toContain("Vente ou location");
  });
  it("accepts an unnamed invitation without putting its internal title in the email", () => {
    const title = invitationGameTitle("", "Édouard", "Vuillemin");
    expect(title).toBe("Jeu à renseigner — Édouard Vuillemin");
    expect(invitationGameName(title)).toBe("");
    expect(invitationGameName(invitationGameTitle("Lean TPS", "Édouard", "Vuillemin"))).toBe("Lean TPS");
  });
  it("requires page url or pdf", () => {
    const f = { ...complete(), game_page_url: null };
    expect(missingForSubmit(f, files)).toContain("URL de la page du jeu ou PDF");
    expect(missingForSubmit(f, [...files, { kind: "pdf" }])).toEqual([]);
  });
  it("rejects bad file types and over 10 MB", () => {
    expect(fileKindAllowed("photo", "image/svg+xml", 10, [])).not.toBeNull();
    expect(fileKindAllowed("pdf", "application/pdf", 11 * 1024 * 1024, [])).not.toBeNull();
    expect(fileKindAllowed("photo", "image/png", 1000, [])).toBeNull();
  });
  it("formats 15 % commission", () => {
    expect(formatCommission(0.15)).toBe("15 %");
    expect(formatCommission(0.125)).toBe("12,5 %");
  });
  it("location variables empty when not offered", () => {
    const p = buildContractPayload({ reference: "DIST-2026-001", form: complete(), commissionRate: 0.15, date: new Date(), distributorSignature: "" });
    expect(p.LOCATION_ACTIVE).toBe(false);
    expect(p.LOCATION_TARIF_HT).toBe("");
    expect(p.NOM_REPRESENTANT).toBe("Édouard Vuillemin");
  });
  it("OTP: one minute between sends, 5 attempts, 10 min", () => {
    const now = Date.now();
    expect(otpSendRefusal(1, new Date(now - 30_000).toISOString(), now)).not.toBeNull();
    expect(otpSendRefusal(1, new Date(now - 61_000).toISOString(), now)).toBeNull();
    expect(otpCheckRefusal({ otp_hash: "h", otp_expires_at: new Date(now + 1000).toISOString(), otp_attempts: 5 }, now)).not.toBeNull();
    expect(otpCheckRefusal({ otp_hash: "h", otp_expires_at: new Date(now - 1).toISOString(), otp_attempts: 0 }, now)).not.toBeNull();
  });
  it("reminders at J+3 then J+7", () => {
    const now = Date.now(); const d = (n: number) => new Date(now - n * 86_400_000).toISOString();
    expect(reminderDue(0, d(2), now)).toBe(false);
    expect(reminderDue(0, d(3), now)).toBe(true);
    expect(reminderDue(1, d(6), now)).toBe(false);
    expect(reminderDue(1, d(7), now)).toBe(true);
    expect(reminderDue(2, d(30), now)).toBe(false);
  });
});
