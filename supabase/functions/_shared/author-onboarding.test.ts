import { describe, it, expect } from "vitest";
import {
  sanitizeForm, missingForSubmit, fileKindAllowed, formatCommission, buildContractPayload,
  otpSendRefusal, otpCheckRefusal, reminderDue,
} from "./author-onboarding";

const complete = () => sanitizeForm({
  legal_name: "Lean SAS", postal_address: "1 rue X", legal_rep_first_name: "Édouard", legal_rep_last_name: "Vuillemin",
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
    expect(missingForSubmit(f, files)).toHaveLength(4);
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
