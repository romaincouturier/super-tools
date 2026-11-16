// @vitest-environment node
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it, vi } from "vitest";

const workflow = parse(readFileSync(".github/workflows/autofix-main.yml", "utf8"));
const guard = workflow.jobs.autofix.steps.find((step: any) => step.id === "ci").with.script;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function validate(id: string, patch: Record<string, unknown> = {}) {
  const setOutput = vi.fn();
  const getWorkflowRun = vi.fn().mockResolvedValue({ data: { name: "CI", head_branch: "main", status: "completed", conclusion: "failure", head_sha: "verified-sha", repository: { full_name: "romaincouturier/super-tools" }, ...patch } });
  await new AsyncFunction("process", "github", "context", "core", guard)({ env: { CI_RUN_ID: id } }, { rest: { actions: { getWorkflowRun } } }, { repo: { owner: "romaincouturier", repo: "super-tools" } }, { setOutput });
  return { setOutput, getWorkflowRun };
}
describe("limites des réparations Claude GitHub", () => {
  it("ne démarre plus automatiquement après les échecs CI", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.ci_run_id.required).toBe(true);
  });
  it("borne les tours, le budget estimé et la durée", () => {
    const args = workflow.jobs.autofix.steps.find((step: any) => step.uses === "anthropics/claude-code-action@v1").with.claude_args;
    expect(args).toMatch(/--max-turns 12(?:\s|$)/);
    expect(args).toMatch(/--max-budget-usd 5(?:\s|$)/);
    expect(workflow.jobs.autofix["timeout-minutes"]).toBe(20);
  });
  it("accepte seulement le run CI échoué demandé", async () => {
    const result = await validate("43968095074");
    expect(result.getWorkflowRun.mock.calls[0][0].run_id).toBe("43968095074");
    expect(result.setOutput).toHaveBeenCalledWith("sha", "verified-sha");
  });
  it.each([{ conclusion: "success" }, { status: "in_progress" }, { head_branch: "other" }, { name: "Autofix main" }, { repository: { full_name: "other/repo" } }])("refuse les runs hors périmètre : %j", async (patch) => {
    await expect(validate("123", patch)).rejects.toThrow("Seul un run CI");
  });
  it("refuse un identifiant qui injecte une commande", async () => {
    await expect(validate("123; echo surprise")).rejects.toThrow("Identifiant CI invalide");
  });
});