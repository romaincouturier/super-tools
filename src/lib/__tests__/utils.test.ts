import { describe, it, expect } from "vitest";
import { capitalizeName, normalizeEmail } from "../utils";

describe("capitalizeName", () => {
  it("capitalizes a simple name", () => {
    expect(capitalizeName("jean")).toBe("Jean");
  });

  it("capitalizes a hyphenated name", () => {
    expect(capitalizeName("jean-pierre")).toBe("Jean-Pierre");
  });

  it("handles ALL CAPS input", () => {
    expect(capitalizeName("DE LA FONTAINE")).toBe("De La Fontaine");
  });

  it("handles mixed case", () => {
    expect(capitalizeName("jEaN-pIERRE dupont")).toBe("Jean-Pierre Dupont");
  });

  it("trims whitespace", () => {
    expect(capitalizeName("  jean  ")).toBe("Jean");
  });

  it("returns null for null/undefined input", () => {
    expect(capitalizeName(null)).toBeNull();
    expect(capitalizeName(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(capitalizeName("")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims email", () => {
    expect(normalizeEmail("  Jean@Example.COM  ")).toBe("jean@example.com");
  });

  it("returns null for null/undefined input", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeEmail("")).toBeNull();
  });

  it("handles already normalized email", () => {
    expect(normalizeEmail("test@example.com")).toBe("test@example.com");
  });
});
