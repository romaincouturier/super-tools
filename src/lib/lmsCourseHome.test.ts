import { describe, it, expect } from "vitest";
import {
  homeCtaLabel,
  DEFAULT_CTA_LABEL_START,
  DEFAULT_CTA_LABEL_RESUME,
  CTA_LABEL_MAX_LENGTH,
  shouldShowProgress,
} from "./lmsCourseHome";

describe("homeCtaLabel", () => {
  it("falls back to the historical labels for an untouched course", () => {
    expect(homeCtaLabel(null, 0)).toBe(DEFAULT_CTA_LABEL_START);
    expect(homeCtaLabel(null, 42)).toBe(DEFAULT_CTA_LABEL_RESUME);
    expect(homeCtaLabel(undefined, 0)).toBe(DEFAULT_CTA_LABEL_START);
    expect(homeCtaLabel({}, 0)).toBe(DEFAULT_CTA_LABEL_START);
    expect(homeCtaLabel({}, 100)).toBe(DEFAULT_CTA_LABEL_RESUME);
  });

  it("uses the custom label matching the progression state", () => {
    const config = { cta_label_start: "Démarrer le parcours", cta_label_resume: "Reprendre où j'en étais" };
    expect(homeCtaLabel(config, 0)).toBe("Démarrer le parcours");
    expect(homeCtaLabel(config, 1)).toBe("Reprendre où j'en étais");
  });

  it("keeps the default for the field left empty", () => {
    expect(homeCtaLabel({ cta_label_start: "Découvrir" }, 0)).toBe("Découvrir");
    expect(homeCtaLabel({ cta_label_start: "Découvrir" }, 50)).toBe(DEFAULT_CTA_LABEL_RESUME);
    expect(homeCtaLabel({ cta_label_resume: "Reprendre" }, 0)).toBe(DEFAULT_CTA_LABEL_START);
  });

  it("treats an emptied field as a reset to the default", () => {
    expect(homeCtaLabel({ cta_label_start: "" }, 0)).toBe(DEFAULT_CTA_LABEL_START);
    expect(homeCtaLabel({ cta_label_start: "   " }, 0)).toBe(DEFAULT_CTA_LABEL_START);
    expect(homeCtaLabel({ cta_label_resume: null }, 10)).toBe(DEFAULT_CTA_LABEL_RESUME);
  });

  it("keeps both defaults within the length limit offered to the trainer", () => {
    expect(DEFAULT_CTA_LABEL_START.length).toBeLessThanOrEqual(CTA_LABEL_MAX_LENGTH);
    expect(DEFAULT_CTA_LABEL_RESUME.length).toBeLessThanOrEqual(CTA_LABEL_MAX_LENGTH);
  });
});

describe("shouldShowProgress", () => {
  it("multi-sequence course is untouched (auto by default)", () => {
    expect(shouldShowProgress(null, 2)).toBe(true);
    expect(shouldShowProgress(undefined, 12)).toBe(true);
    expect(shouldShowProgress({}, 2)).toBe(true);
    expect(shouldShowProgress({ progress_display: "auto" }, 2)).toBe(true);
  });

  it("auto hides progress on a single-sequence course", () => {
    expect(shouldShowProgress(null, 1)).toBe(false);
    expect(shouldShowProgress({ progress_display: "auto" }, 1)).toBe(false);
  });

  it("auto hides progress on an empty course (nothing to track either)", () => {
    expect(shouldShowProgress(null, 0)).toBe(false);
  });

  it("always forces the display, even on a single sequence", () => {
    expect(shouldShowProgress({ progress_display: "always" }, 1)).toBe(true);
    expect(shouldShowProgress({ progress_display: "always" }, 0)).toBe(true);
  });

  it("never hides the display, even on a long course", () => {
    expect(shouldShowProgress({ progress_display: "never" }, 40)).toBe(false);
  });

  it("adding a second sequence brings the display back with no other change", () => {
    const config = { progress_display: "auto" as const };
    expect(shouldShowProgress(config, 1)).toBe(false);
    expect(shouldShowProgress(config, 2)).toBe(true);
  });
});
