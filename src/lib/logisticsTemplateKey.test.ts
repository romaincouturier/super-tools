import { describe, it, expect } from "vitest";
// Import from the pure module so the test doesn't pull in supabase client.
import { resolveTemplateKey } from "@/lib/logisticsTemplateKey";

describe("resolveTemplateKey", () => {
  describe("missions", () => {
    it("returns remote key when isRemote=true", () => {
      expect(resolveTemplateKey({ entityType: "mission", isRemote: true })).toBe("mission.remote");
    });

    it("returns presentiel key otherwise", () => {
      expect(resolveTemplateKey({ entityType: "mission" })).toBe("mission.presentiel");
      expect(resolveTemplateKey({ entityType: "mission", isRemote: false })).toBe("mission.presentiel");
    });

    it("ignores format/sessionType for missions", () => {
      expect(resolveTemplateKey({ entityType: "mission", format: "classe_virtuelle", sessionType: "inter" }))
        .toBe("mission.presentiel");
    });
  });

  describe("trainings", () => {
    it("maps classe_virtuelle regardless of sessionType", () => {
      expect(resolveTemplateKey({ entityType: "training", format: "classe_virtuelle" }))
        .toBe("training.classe_virtuelle");
      expect(resolveTemplateKey({ entityType: "training", format: "classe_virtuelle", sessionType: "intra" }))
        .toBe("training.classe_virtuelle");
    });

    it("maps e_learning regardless of sessionType", () => {
      expect(resolveTemplateKey({ entityType: "training", format: "e_learning" }))
        .toBe("training.e_learning");
      expect(resolveTemplateKey({ entityType: "training", format: "e_learning", sessionType: "inter" }))
        .toBe("training.e_learning");
    });

    it("splits presentiel into inter / intra", () => {
      expect(resolveTemplateKey({ entityType: "training", format: "presentiel", sessionType: "inter" }))
        .toBe("training.inter.presentiel");
      expect(resolveTemplateKey({ entityType: "training", format: "presentiel", sessionType: "intra" }))
        .toBe("training.intra.presentiel");
    });

    it("defaults to inter when sessionType is missing / null / unknown", () => {
      expect(resolveTemplateKey({ entityType: "training", format: "presentiel" }))
        .toBe("training.inter.presentiel");
      expect(resolveTemplateKey({ entityType: "training", format: "presentiel", sessionType: null }))
        .toBe("training.inter.presentiel");
      expect(resolveTemplateKey({ entityType: "training", format: "presentiel", sessionType: "mixed" }))
        .toBe("training.inter.presentiel");
    });

    it("defaults format to presentiel when null/undefined", () => {
      expect(resolveTemplateKey({ entityType: "training" })).toBe("training.inter.presentiel");
      expect(resolveTemplateKey({ entityType: "training", format: null })).toBe("training.inter.presentiel");
    });
  });
});
