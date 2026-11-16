// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const ci = parse(readFileSync(".github/workflows/ci.yml", "utf8"));

describe("suppression Autofix et maintien de la CI", () => {
  it("supprime le workflow de réparation payante", () => {
    expect(existsSync(".github/workflows/autofix-main.yml")).toBe(false);
  });
  it("conserve les contrôles automatiques sur main et les PR", () => {
    expect(ci.on.push.branches).toContain("main");
    expect(Object.keys(ci.on)).toContain("pull_request");
    const checks = ci.jobs.checks.steps.map((step: { run?: string }) => step.run);
    expect(checks).toContain("npm run typecheck");
    expect(checks).toContain("bash scripts/check-rules.sh");
    expect(checks).toContain("npm test");
    expect(ci.jobs.smoke.steps.map((step: { run?: string }) => step.run)).toContain("npm run test:e2e");
  });
});