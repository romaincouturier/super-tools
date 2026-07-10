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
  it("matches everything with default filters, except archived", () => {
    expect(courseMatchesMetaFilters(course(), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "draft" }), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "to_review" }), DEFAULT_COURSE_META_FILTERS)).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "archived" }), DEFAULT_COURSE_META_FILTERS)).toBe(false);
  });

  it("shows archived only via the archives view or the archived status filter", () => {
    const archived = course({ status: "archived" });
    expect(courseMatchesMetaFilters(archived, { ...DEFAULT_COURSE_META_FILTERS, view: "archives" })).toBe(true);
    expect(courseMatchesMetaFilters(archived, { ...DEFAULT_COURSE_META_FILTERS, status: "archived" })).toBe(true);
    expect(courseMatchesMetaFilters(archived, { ...DEFAULT_COURSE_META_FILTERS, view: "publies" })).toBe(false);
  });

  it("filters by quick view on status", () => {
    expect(courseMatchesMetaFilters(course({ status: "draft" }), { ...DEFAULT_COURSE_META_FILTERS, view: "brouillons" })).toBe(true);
    expect(courseMatchesMetaFilters(course({ status: "published" }), { ...DEFAULT_COURSE_META_FILTERS, view: "brouillons" })).toBe(false);
    expect(courseMatchesMetaFilters(course({ status: "to_review" }), { ...DEFAULT_COURSE_META_FILTERS, view: "a_verifier" })).toBe(true);
  });

  it("filters by quick view on access", () => {
    expect(courseMatchesMetaFilters(course({ access_type: "payant" }), { ...DEFAULT_COURSE_META_FILTERS, view: "payants" })).toBe(true);
    expect(courseMatchesMetaFilters(course({ access_type: "intra" }), { ...DEFAULT_COURSE_META_FILTERS, view: "payants" })).toBe(false);
    expect(courseMatchesMetaFilters(course({ access_type: "intra" }), { ...DEFAULT_COURSE_META_FILTERS, view: "intra" })).toBe(true);
  });

  it("treats missing access_type as gratuit (rows pre-migration)", () => {
    expect(courseMatchesMetaFilters(course({ access_type: null }), { ...DEFAULT_COURSE_META_FILTERS, view: "gratuits" })).toBe(true);
    expect(courseMatchesMetaFilters(course({ access_type: null }), { ...DEFAULT_COURSE_META_FILTERS, access: "gratuit" })).toBe(true);
  });

  it("combines expertise, access and status filters", () => {
    const c = course({ expertise: "ia", access_type: "payant", status: "published" });
    expect(courseMatchesMetaFilters(c, { view: "tous", expertise: "ia", access: "payant", status: "published" })).toBe(true);
    expect(courseMatchesMetaFilters(c, { view: "tous", expertise: "agilite", access: "payant", status: "published" })).toBe(false);
    expect(courseMatchesMetaFilters(c, { view: "tous", expertise: "ia", access: "gratuit", status: "published" })).toBe(false);
    expect(courseMatchesMetaFilters(c, { view: "tous", expertise: "ia", access: "payant", status: "draft" })).toBe(false);
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
