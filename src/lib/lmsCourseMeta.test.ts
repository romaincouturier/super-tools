import { describe, it, expect } from "vitest";
import {
  courseMatchesMetaFilters,
  DEFAULT_COURSE_META_FILTERS,
  expertiseLabel,
  accessLabel,
  statusLabel,
} from "./lmsCourseMeta";

const course = (over: Partial<{ status: string; access_type: string | null; expertise: string | null }> = {}) => ({
  status: "published",
  access_type: "gratuit",
  expertise: null,
  ...over,
});

describe("courseMatchesMetaFilters", () => {
  it("default filters: every non-archived course, intra included", () => {
    expect(courseMatchesMetaFilters(course(), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "draft" }), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "to_review" }), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ access_type: "intra" }), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "archived" }), DEFAULT_COURSE_META_FILTERS)).toBe(false);
  });

  it("shows archived only via the archived status filter", () => {
    const archived = course({ status: "archived" });
    expect(courseMatchesMetaFilters(archived, { ...DEFAULT_COURSE_META_FILTERS, status: "archived" })).toBe(true);
    expect(courseMatchesMetaFilters(archived, DEFAULT_COURSE_META_FILTERS)).toBe(false);
  });

  it("filters by status", () => {
    expect(courseMatchesMetaFilters(course({ status: "draft" }), { ...DEFAULT_COURSE_META_FILTERS, status: "draft" })).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "published" }), { ...DEFAULT_COURSE_META_FILTERS, status: "draft" })).toBe(false);
    expect(courseMatchesMetaFilters(course({ status: "to_review" }), { ...DEFAULT_COURSE_META_FILTERS, status: "to_review" })).toBe(true);
  });

  it("filters by access", () => {
    expect(courseMatchesMetaFilters(course({ access_type: "payant" }), { ...DEFAULT_COURSE_META_FILTERS, access: "payant" })).toBe(true);
    expect(courseMatchesMetaFilters(course({ access_type: "intra" }), { ...DEFAULT_COURSE_META_FILTERS, access: "payant" })).toBe(false);
    expect(courseMatchesMetaFilters(course({ access_type: "intra" }), { ...DEFAULT_COURSE_META_FILTERS, access: "intra" })).toBe(true);
  });

  it("treats missing access_type as gratuit (rows pre-migration)", () => {
    expect(courseMatchesMetaFilters(course({ access_type: null }), { ...DEFAULT_COURSE_META_FILTERS, access: "gratuit" })).toBe(true);
  });

  it("combines expertise, access and status filters", () => {
    const c = course({ expertise: "ia", access_type: "payant", status: "published" });
    expect(courseMatchesMetaFilters(c, { expertise: "ia", access: "payant", status: "published" })).toBe(true);
    expect(courseMatchesMetaFilters(c, { expertise: "agilite", access: "payant", status: "published" })).toBe(false);
    expect(courseMatchesMetaFilters(c, { expertise: "ia", access: "gratuit", status: "published" })).toBe(false);
    expect(courseMatchesMetaFilters(c, { expertise: "ia", access: "payant", status: "draft" })).toBe(false);
  });
});

describe("labels", () => {
  it("maps known values and falls back gracefully", () => {
    expect(expertiseLabel("facilitation_graphique")).toBe("Facilitation graphique");
    expect(expertiseLabel(null)).toBeNull();
    expect(accessLabel("intra")).toBe("Intra client");
    expect(accessLabel(undefined)).toBe("Gratuit");
    expect(statusLabel("to_review")).toBe("À vérifier");
    expect(statusLabel("unknown")).toBe("Brouillon");
  });
});
