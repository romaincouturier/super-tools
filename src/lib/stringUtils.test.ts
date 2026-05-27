import { describe, it, expect } from "vitest";
import { capitalizeName, normalizeEmail, getInitials } from "./stringUtils";

describe("capitalizeName", () => {
  it("capitalizes a simple lowercase name", () => {
    expect(capitalizeName("jean")).toBe("Jean");
  });

  it("handles ALL CAPS names", () => {
    expect(capitalizeName("DUPONT")).toBe("Dupont");
  });

  it("handles compound hyphenated names", () => {
    expect(capitalizeName("jean-pierre")).toBe("Jean-Pierre");
    expect(capitalizeName("JEAN-PIERRE")).toBe("Jean-Pierre");
  });

  it("handles multi-word names with spaces", () => {
    expect(capitalizeName("de la fontaine")).toBe("De La Fontaine");
    expect(capitalizeName("DE LA FONTAINE")).toBe("De La Fontaine");
  });

  it("handles mixed case names", () => {
    expect(capitalizeName("mArIe ClAiRe")).toBe("Marie Claire");
  });

  it("trims whitespace", () => {
    expect(capitalizeName("  jean  ")).toBe("Jean");
  });

  it("returns null for null, undefined, empty string", () => {
    expect(capitalizeName(null)).toBeNull();
    expect(capitalizeName(undefined)).toBeNull();
    expect(capitalizeName("")).toBeNull();
    expect(capitalizeName("   ")).toBeNull();
  });
});

describe("getInitials", () => {
  it("returns uppercase first chars of first and last name", () => {
    expect(getInitials("Alice", "Martin")).toBe("AM");
  });

  it("handles null/undefined gracefully, returns fallback", () => {
    expect(getInitials(null, null)).toBe("?");
    expect(getInitials(undefined, undefined, "AB")).toBe("AB");
  });

  it("returns single initial when only first name is set", () => {
    expect(getInitials("Alice", null)).toBe("A");
  });

  it("uses provided fallback when both names are empty", () => {
    expect(getInitials("", "", "XY")).toBe("XY");
  });

  it("uses custom fallback (email prefix) for community avatars", () => {
    expect(getInitials(null, null, "al")).toBe("al");
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims email", () => {
    expect(normalizeEmail("  Jean@Example.COM  ")).toBe("jean@example.com");
  });

  it("returns null for null, undefined, empty string", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});
