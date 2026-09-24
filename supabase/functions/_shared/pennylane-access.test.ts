import { describe, expect, it } from "vitest";
import { canUsePennylane, PENNYLANE_MODULE } from "./pennylane-access.ts";

function client(answers: Record<string, { data: unknown; error?: unknown }>) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      const a = answers[fn] ?? { data: null };
      return Promise.resolve({ data: a.data, error: a.error ?? null });
    },
  };
}

describe("canUsePennylane", () => {
  it("autorise un admin", async () => {
    expect(await canUsePennylane(client({ is_admin: { data: true }, has_module_access: { data: false } }), "u1")).toBe(true);
  });

  it("autorise un compte qui a le module Finances, avec l'identifiant vérifié", async () => {
    const c = client({ is_admin: { data: false }, has_module_access: { data: true } });
    expect(await canUsePennylane(c, "u1")).toBe(true);
    expect(c.calls).toContainEqual({ fn: "has_module_access", args: { _user_id: "u1", _module: PENNYLANE_MODULE } });
  });

  it("refuse un compte connecté sans droit (apprenant, inscription libre)", async () => {
    expect(await canUsePennylane(client({ is_admin: { data: false }, has_module_access: { data: false } }), "u1")).toBe(false);
  });

  it("refuse quand la vérification échoue", async () => {
    const failing = { data: true, error: { message: "boom" } };
    expect(await canUsePennylane(client({ is_admin: failing, has_module_access: failing }), "u1")).toBe(false);
  });
});
