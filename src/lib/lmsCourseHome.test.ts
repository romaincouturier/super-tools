import { describe, it, expect } from "vitest";
import {
  homeCtaLabel,
  DEFAULT_CTA_LABEL_START,
  DEFAULT_CTA_LABEL_RESUME,
  CTA_LABEL_MAX_LENGTH,
  shouldShowProgress,
  resolveIntroBox,
  DEFAULT_TIPS,
  homeDashboardGridClass,
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

describe("resolveIntroBox", () => {
  it("keeps the historical tips box for an untouched course", () => {
    expect(resolveIntroBox(null)).toEqual({ title: "Conseils pour bien démarrer", items: DEFAULT_TIPS });
    expect(resolveIntroBox({})).toEqual({ title: "Conseils pour bien démarrer", items: DEFAULT_TIPS });
  });

  it("keeps the saved tips of a course that has some", () => {
    expect(resolveIntroBox({ tips: ["Un", "Deux"] })).toEqual({
      title: "Conseils pour bien démarrer",
      items: ["Un", "Deux"],
    });
  });

  it("hides the box entirely on « Aucun encadré »", () => {
    expect(resolveIntroBox({ intro_box_type: "none", tips: ["Un"] })).toBeNull();
  });

  it("uses the preset title of the chosen type", () => {
    expect(resolveIntroBox({ intro_box_type: "thread", tips: ["Un"] })?.title).toBe("Votre fil rouge");
    expect(resolveIntroBox({ intro_box_type: "explore", tips: ["Un"] })?.title).toBe("Ce que vous allez explorer");
  });

  it("lets a custom title win, and falls back when it is emptied", () => {
    expect(resolveIntroBox({ intro_box_type: "thread", intro_box_title: "Notre fil", tips: ["Un"] })?.title).toBe("Notre fil");
    expect(resolveIntroBox({ intro_box_type: "thread", intro_box_title: "   ", tips: ["Un"] })?.title).toBe("Votre fil rouge");
    expect(resolveIntroBox({ intro_box_type: "thread", intro_box_title: null, tips: ["Un"] })?.title).toBe("Votre fil rouge");
  });

  it("drops blank lines and hides a non-tips box left empty", () => {
    expect(resolveIntroBox({ tips: ["Un", "  ", ""] })?.items).toEqual(["Un"]);
    expect(resolveIntroBox({ intro_box_type: "explore", tips: [] })).toBeNull();
    expect(resolveIntroBox({ intro_box_type: "explore", tips: ["  "] })).toBeNull();
  });

  it("still falls back to the default tips when the tips box is left empty", () => {
    expect(resolveIntroBox({ intro_box_type: "tips", tips: [] })?.items).toEqual(DEFAULT_TIPS);
  });
});

describe("homeDashboardGridClass", () => {
  it("keeps four columns when the four blocks are shown", () => {
    expect(homeDashboardGridClass(4)).toContain("lg:grid-cols-4");
  });

  it("drops to three columns for three blocks", () => {
    expect(homeDashboardGridClass(3)).toContain("lg:grid-cols-3");
    expect(homeDashboardGridClass(3)).not.toContain("lg:grid-cols-4");
  });

  it("uses two balanced columns for two blocks", () => {
    const cls = homeDashboardGridClass(2);
    expect(cls).toContain("sm:grid-cols-2");
    expect(cls).not.toContain("lg:grid-cols-3");
    expect(cls).not.toContain("lg:grid-cols-4");
  });

  it("caps the width of a lone block instead of stretching it", () => {
    const cls = homeDashboardGridClass(1);
    expect(cls).toContain("grid-cols-1");
    expect(cls).toContain("sm:max-w-md");
    expect(cls).not.toContain("grid-cols-2");
  });

  it("always stacks on mobile and keeps the same gap", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(homeDashboardGridClass(n)).toContain("grid-cols-1");
      expect(homeDashboardGridClass(n)).toContain("gap-5");
    }
  });
});
