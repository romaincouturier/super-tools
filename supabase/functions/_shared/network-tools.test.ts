import { describe, expect, it } from "vitest";
import { meetingDate, meetingNotes } from "./network-tools";

describe("network-tools", () => {
  it("prend la date Fireflies en heure de Paris", () => {
    expect(meetingDate({ fireflies_date: "2026-11-04T23:30:00.000Z" }, "2026-11-10T10:00:00Z")).toBe("2026-11-05");
  });
  it("retombe sur la date de création sans métadonnée", () => {
    expect(meetingDate({}, "2026-11-04T10:00:00Z")).toBe("2026-11-04");
  });
  it("met résumé et lien du transcript dans les notes", () => {
    const n = meetingNotes("Café pair", "On parle partenariat", "https://x/t?transcript=1");
    expect(n).toContain("On parle partenariat");
    expect(n).toContain("https://x/t?transcript=1");
  });
});
