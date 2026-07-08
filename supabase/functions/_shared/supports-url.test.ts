/**
 * Tests for supports-url helpers — personalization of LMS/support links in
 * emails. The public LMS player identifies the learner via the ?email= URL
 * param; a link without it shows "Accès non autorisé" (rule 035).
 */
import { describe, it, expect } from "vitest";
import {
  appendEmailParam,
  personalizeSupportsLinks,
  resolveSupportsUrlBase,
} from "./supports-url.ts";

const BASE = "https://super-tools.lovable.app";

describe("appendEmailParam", () => {
  it("appends email as first query param", () => {
    expect(appendEmailParam(`${BASE}/formation-support/t1`, "a@b.fr"))
      .toBe(`${BASE}/formation-support/t1?email=a%40b.fr`);
  });

  it("appends with & when a query string exists", () => {
    expect(appendEmailParam(`${BASE}/formation-support/t1?lesson=l1`, "a@b.fr"))
      .toBe(`${BASE}/formation-support/t1?lesson=l1&email=a%40b.fr`);
  });

  it("does not duplicate an existing email param", () => {
    const url = `${BASE}/formation-support/t1?email=x%40y.fr`;
    expect(appendEmailParam(url, "a@b.fr")).toBe(url);
  });

  it("returns the url unchanged without email, and empty url unchanged", () => {
    expect(appendEmailParam(`${BASE}/x`, null)).toBe(`${BASE}/x`);
    expect(appendEmailParam("", "a@b.fr")).toBe("");
  });
});

describe("personalizeSupportsLinks", () => {
  it("personalizes /formation-support/ links in html", () => {
    const html = `<a href="${BASE}/formation-support/t1">supports</a>`;
    expect(personalizeSupportsLinks(html, "a@b.fr"))
      .toBe(`<a href="${BASE}/formation-support/t1?email=a%40b.fr">supports</a>`);
  });

  it("personalizes /lms/ player links pasted in a custom template", () => {
    const text = `Le cours : ${BASE}/lms/c1/player`;
    expect(personalizeSupportsLinks(text, "a@b.fr"))
      .toBe(`Le cours : ${BASE}/lms/c1/player?email=a%40b.fr`);
  });

  it("leaves external urls untouched", () => {
    const html = `<a href="https://drive.google.com/xyz">Drive</a>`;
    expect(personalizeSupportsLinks(html, "a@b.fr")).toBe(html);
  });

  it("does not absorb sentence punctuation into the url", () => {
    const text = `Voici le lien : ${BASE}/formation-support/t1.`;
    expect(personalizeSupportsLinks(text, "a@b.fr"))
      .toBe(`Voici le lien : ${BASE}/formation-support/t1?email=a%40b.fr.`);
  });

  it("skips links that already carry an email param", () => {
    const html = `${BASE}/formation-support/t1?email=x%40y.fr`;
    expect(personalizeSupportsLinks(html, "a@b.fr")).toBe(html);
  });
});

describe("resolveSupportsUrlBase", () => {
  const mockSupabase = (supportRecord: unknown) => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: supportRecord }),
        }),
      }),
    }),
  });

  it("returns the explicit supports_url when set", async () => {
    const url = await resolveSupportsUrlBase(
      mockSupabase(null),
      { supports_url: "https://drive.google.com/xyz", supports_lms_course_id: "c1" },
      "t1",
      BASE,
    );
    expect(url).toBe("https://drive.google.com/xyz");
  });

  it("derives /formation-support/<id> when an LMS course is linked", async () => {
    const url = await resolveSupportsUrlBase(
      mockSupabase(null),
      { supports_url: null, supports_lms_course_id: "c1" },
      "t1",
      BASE,
    );
    expect(url).toBe(`${BASE}/formation-support/t1`);
  });

  it("derives /formation-support/<id> when an editor support exists", async () => {
    const url = await resolveSupportsUrlBase(
      mockSupabase({ id: "s1" }),
      { supports_url: null, supports_lms_course_id: null },
      "t1",
      BASE,
    );
    expect(url).toBe(`${BASE}/formation-support/t1`);
  });

  it("returns empty when nothing is configured", async () => {
    const url = await resolveSupportsUrlBase(
      mockSupabase(null),
      { supports_url: null, supports_lms_course_id: null },
      "t1",
      BASE,
    );
    expect(url).toBe("");
  });
});
