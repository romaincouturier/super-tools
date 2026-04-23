import { describe, it, expect } from "vitest";
import { displayNameOf, initialsOf, type UserProfileLite } from "./userDisplay";

const mkUser = (over: Partial<UserProfileLite>): UserProfileLite => ({
  user_id: "u1",
  first_name: null,
  last_name: null,
  email: "someone@example.com",
  ...over,
});

describe("displayNameOf", () => {
  it("prefers first + last name when both are set", () => {
    expect(displayNameOf(mkUser({ first_name: "Romain", last_name: "Couturier" }))).toBe("Romain Couturier");
  });

  it("falls back to first name alone", () => {
    expect(displayNameOf(mkUser({ first_name: "Romain" }))).toBe("Romain");
  });

  it("falls back to local-part of the email when no name", () => {
    expect(displayNameOf(mkUser({ email: "marine.l@example.com" }))).toBe("marine.l");
  });
});

describe("initialsOf", () => {
  it("uses first and last initials", () => {
    expect(initialsOf(mkUser({ first_name: "Romain", last_name: "Couturier" }))).toBe("RC");
  });

  it("falls back to first + email second char when no last name", () => {
    // first = "R" (from first_name), last = "e" (email[1])
    expect(initialsOf(mkUser({ first_name: "Romain", email: "rc@example.com" }))).toBe("RC");
  });

  it("uses email[0] + email[1] when no names are set", () => {
    expect(initialsOf(mkUser({ email: "marine.l@example.com" }))).toBe("MA");
  });

  it("always returns uppercase", () => {
    expect(initialsOf(mkUser({ first_name: "alice", last_name: "bob" }))).toBe("AB");
  });
});
