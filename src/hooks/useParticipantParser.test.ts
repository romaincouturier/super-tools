import { describe, it, expect } from "vitest";
import { parseParticipants } from "./useParticipantParser";

describe("parseParticipants — standard mode", () => {
  it("parses a single email-only line", () => {
    const result = parseParticipants("alice@example.com", false);
    expect(result.participants).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.participants[0].email).toBe("alice@example.com");
  });

  it("parses name + email on a line", () => {
    const result = parseParticipants("Jean Dupont jean@example.com", false);
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toEqual({
      email: "jean@example.com",
      firstName: "Jean",
      lastName: "Dupont",
      company: undefined,
    });
  });

  it("parses name + email + company (comma-separated)", () => {
    const result = parseParticipants("Jean Dupont jean@example.com, Acme Corp", false);
    expect(result.participants[0].company).toBe("Acme Corp");
    expect(result.participants[0].firstName).toBe("Jean");
    expect(result.participants[0].lastName).toBe("Dupont");
  });

  it("parses multiple lines", () => {
    const text = "alice@example.com\nbob@example.com\ncharlie@example.com";
    const result = parseParticipants(text, false);
    expect(result.participants).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it("skips blank lines", () => {
    const text = "alice@example.com\n\n\nbob@example.com";
    const result = parseParticipants(text, false);
    expect(result.participants).toHaveLength(2);
  });

  it("reports error for lines without valid email", () => {
    const text = "not-an-email\nalice@example.com";
    const result = parseParticipants(text, false);
    expect(result.participants).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Ligne 1");
  });

  it("lowercases emails", () => {
    const result = parseParticipants("Alice@Example.COM", false);
    expect(result.participants[0].email).toBe("alice@example.com");
  });

  it("returns empty arrays for empty input", () => {
    const result = parseParticipants("", false);
    expect(result.participants).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("parseParticipants — inter-entreprise mode", () => {
  it("parses participant with sponsor using pipe separator", () => {
    const text = "Jean Dupont jean@example.com | Marie Sponsor marie@sponsor.com";
    const result = parseParticipants(text, true);
    expect(result.participants).toHaveLength(1);
    const p = result.participants[0];
    expect(p.email).toBe("jean@example.com");
    expect(p.firstName).toBe("Jean");
    expect(p.lastName).toBe("Dupont");
    expect(p.sponsorEmail).toBe("marie@sponsor.com");
    expect(p.sponsorFirstName).toBe("Marie");
    expect(p.sponsorLastName).toBe("Sponsor");
  });

  it("parses participant without sponsor part", () => {
    const text = "alice@example.com";
    const result = parseParticipants(text, true);
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].sponsorEmail).toBeUndefined();
  });

  it("parses participant with company (comma) and sponsor", () => {
    const text = "Jean Dupont jean@example.com, Acme | sponsor@corp.com";
    const result = parseParticipants(text, true);
    const p = result.participants[0];
    expect(p.company).toBe("Acme");
    expect(p.sponsorEmail).toBe("sponsor@corp.com");
  });

  it("reports error for line without participant email in inter mode", () => {
    const text = "no email here | sponsor@corp.com";
    const result = parseParticipants(text, true);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Ligne 1");
  });
});
