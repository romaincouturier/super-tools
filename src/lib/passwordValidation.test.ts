import { describe, it, expect } from "vitest";
import { validatePassword } from "./passwordValidation";

describe("validatePassword", () => {
  // ── Cas nominaux ───────────────────────────────────────────────────

  it("accepts a strong password with all criteria", () => {
    const result = validatePassword("MyP@ss1word");
    expect(result).toEqual({
      isValid: true,
      hasMinLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
  });

  it("accepts minimum valid password (exactly 8 chars)", () => {
    const result = validatePassword("Aa1!xxxx");
    expect(result.isValid).toBe(true);
  });

  // ── Cas aux limites ────────────────────────────────────────────────

  it("rejects empty password", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
    expect(result.hasUppercase).toBe(false);
    expect(result.hasLowercase).toBe(false);
    expect(result.hasNumber).toBe(false);
    expect(result.hasSpecialChar).toBe(false);
  });

  it("rejects password with 7 characters (one below minimum)", () => {
    const result = validatePassword("Aa1!xxx");
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
  });

  it("rejects password missing uppercase", () => {
    const result = validatePassword("myp@ss1word");
    expect(result.isValid).toBe(false);
    expect(result.hasUppercase).toBe(false);
    expect(result.hasLowercase).toBe(true);
  });

  it("rejects password missing lowercase", () => {
    const result = validatePassword("MYP@SS1WORD");
    expect(result.isValid).toBe(false);
    expect(result.hasLowercase).toBe(false);
    expect(result.hasUppercase).toBe(true);
  });

  it("rejects password missing number", () => {
    const result = validatePassword("MyP@ssword");
    expect(result.isValid).toBe(false);
    expect(result.hasNumber).toBe(false);
  });

  it("rejects password missing special character", () => {
    const result = validatePassword("MyPass1word");
    expect(result.isValid).toBe(false);
    expect(result.hasSpecialChar).toBe(false);
  });

  // ── Caractères spéciaux variés ─────────────────────────────────────

  it.each([
    "!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
    "_", "+", "-", "=", "[", "]", "{", "}", ";", "'",
    ":", '"', "\\", "|", ",", ".", "<", ">", "/", "?",
  ])("recognizes '%s' as a special character", (char) => {
    const password = `Aa1${char}xxxx`;
    const result = validatePassword(password);
    expect(result.hasSpecialChar).toBe(true);
  });

  // ── Cas en erreur / edge cases ─────────────────────────────────────

  it("handles password with only spaces", () => {
    const result = validatePassword("        ");
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(true); // 8 spaces = 8 chars
    expect(result.hasUppercase).toBe(false);
  });

  it("handles unicode characters", () => {
    const result = validatePassword("Résumé1!xx");
    expect(result.hasMinLength).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSpecialChar).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it("handles very long password", () => {
    const long = "A".repeat(100) + "a1!" + "x".repeat(100);
    const result = validatePassword(long);
    expect(result.isValid).toBe(true);
  });
});
