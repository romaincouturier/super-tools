import { describe, it, expect } from "vitest";
import { validatePassword } from "../passwordValidation";

describe("validatePassword", () => {
  it("returns all false for empty string", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
    expect(result.hasUppercase).toBe(false);
    expect(result.hasLowercase).toBe(false);
    expect(result.hasNumber).toBe(false);
    expect(result.hasSpecialChar).toBe(false);
  });

  it("validates minimum length of 8 characters", () => {
    expect(validatePassword("Aa1!").hasMinLength).toBe(false);
    expect(validatePassword("Aa1!abcd").hasMinLength).toBe(true);
  });

  it("detects uppercase letters", () => {
    expect(validatePassword("abc").hasUppercase).toBe(false);
    expect(validatePassword("Abc").hasUppercase).toBe(true);
  });

  it("detects lowercase letters", () => {
    expect(validatePassword("ABC").hasLowercase).toBe(false);
    expect(validatePassword("ABc").hasLowercase).toBe(true);
  });

  it("detects numbers", () => {
    expect(validatePassword("abc").hasNumber).toBe(false);
    expect(validatePassword("abc1").hasNumber).toBe(true);
  });

  it("detects special characters", () => {
    expect(validatePassword("abc").hasSpecialChar).toBe(false);
    expect(validatePassword("abc!").hasSpecialChar).toBe(true);
    expect(validatePassword("abc@").hasSpecialChar).toBe(true);
    expect(validatePassword("abc#").hasSpecialChar).toBe(true);
  });

  it("returns isValid true when all criteria are met", () => {
    const result = validatePassword("Abcdef1!");
    expect(result.isValid).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSpecialChar).toBe(true);
  });

  it("returns isValid false when one criterion is missing", () => {
    // Missing special char
    expect(validatePassword("Abcdefg1").isValid).toBe(false);
    // Missing number
    expect(validatePassword("Abcdefg!").isValid).toBe(false);
    // Missing uppercase
    expect(validatePassword("abcdefg1!").isValid).toBe(false);
    // Missing lowercase
    expect(validatePassword("ABCDEFG1!").isValid).toBe(false);
  });
});
