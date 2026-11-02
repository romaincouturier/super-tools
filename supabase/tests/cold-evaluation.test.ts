import { describe, expect, it } from "vitest";
import { planSponsorColdEvaluations, resolveSponsorRecipient } from "../functions/_shared/cold-evaluation";

const fatima = "fatima@apicil.com";

describe("sponsor cold evaluation planning", () => {
  it("plans one training-level evaluation for an intra session with a sponsor", () => {
    expect(planSponsorColdEvaluations({ format_formation: "intra", sponsor_email: "rh@acoss.fr" }, [{ id: "p1" }])).toEqual([null]);
  });
  it("plans one evaluation per distinct sponsor in inter sessions", () => {
    const plan = planSponsorColdEvaluations({ format_formation: "inter-entreprises" }, [
      { id: "p1", sponsor_email: "a@x.fr" },
      { id: "p2", sponsor_email: "A@x.fr " },
      { id: "p3", sponsor_email: "b@y.fr" },
      { id: "p4" },
    ]);
    expect(plan).toEqual(["p1", "p3"]);
  });
  it("plans a single evaluation when a virtual class shares one participant sponsor (AI4Product)", () => {
    const plan = planSponsorColdEvaluations({ format_formation: "classe_virtuelle", sponsor_email: null }, [
      { id: "p1" },
      { id: "p2", sponsor_email: fatima },
      { id: "p3", sponsor_email: fatima },
    ]);
    expect(plan).toEqual([null]);
  });
  it("plans per sponsor when a virtual class has several participant sponsors", () => {
    const plan = planSponsorColdEvaluations({ format_formation: "classe_virtuelle" }, [
      { id: "p1", sponsor_email: "a@x.fr" },
      { id: "p2", sponsor_email: "b@y.fr" },
    ]);
    expect(plan).toEqual(["p1", "p2"]);
  });
});

describe("sponsor cold evaluation recipient", () => {
  it("falls back to the single participant sponsor when the session has none", () => {
    const r = resolveSponsorRecipient({ sponsor_email: null }, null, [
      { id: "p1" },
      { id: "p2", sponsor_email: fatima, sponsor_first_name: "Fatima", company: "Apicil" },
    ]);
    expect(r?.email).toBe(fatima);
    expect(r?.name).toBe("Fatima");
  });
  it("returns null when no sponsor email is known", () => {
    expect(resolveSponsorRecipient({ sponsor_email: null }, null, [{ id: "p1" }])).toBeNull();
  });
  it("returns null when participant sponsors are ambiguous", () => {
    expect(
      resolveSponsorRecipient({}, null, [
        { id: "p1", sponsor_email: "a@x.fr" },
        { id: "p2", sponsor_email: "b@y.fr" },
      ]),
    ).toBeNull();
  });
  it("prefers the participant's own sponsor", () => {
    expect(resolveSponsorRecipient({ sponsor_email: "t@x.fr" }, { id: "p1", sponsor_email: "p@x.fr" }, [])?.email).toBe("p@x.fr");
  });
});
