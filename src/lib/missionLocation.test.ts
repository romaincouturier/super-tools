import { describe, it, expect } from "vitest";
import { REMOTE_LOCATION_LABEL, isRemoteLocation } from "./missionLocation";

describe("missionLocation", () => {
  describe("REMOTE_LOCATION_LABEL", () => {
    it("stays stable so downstream consumers (triggers, alerts) don't break", () => {
      expect(REMOTE_LOCATION_LABEL).toBe("Distanciel");
    });
  });

  describe("isRemoteLocation", () => {
    it("is true for the canonical marker", () => {
      expect(isRemoteLocation("Distanciel")).toBe(true);
    });

    it("matches case-insensitively", () => {
      expect(isRemoteLocation("distanciel")).toBe(true);
      expect(isRemoteLocation("DISTANCIEL")).toBe(true);
      expect(isRemoteLocation("DisTanciEl")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(isRemoteLocation("  Distanciel  ")).toBe(true);
      expect(isRemoteLocation("\tDistanciel\n")).toBe(true);
    });

    it("is false for a real city name", () => {
      expect(isRemoteLocation("Lyon")).toBe(false);
      expect(isRemoteLocation("Paris 15e")).toBe(false);
      expect(isRemoteLocation("Distanciel Paris")).toBe(false);
    });

    it("is false for empty, null, undefined", () => {
      expect(isRemoteLocation("")).toBe(false);
      expect(isRemoteLocation(null)).toBe(false);
      expect(isRemoteLocation(undefined)).toBe(false);
    });
  });
});
