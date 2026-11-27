// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/crm-elementor-webhook/index.ts", "utf8");

function setup(failure?: "column" | "card") {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let releaseSlack: () => void = () => {};
  const slackGate = new Promise<void>((resolve) => { releaseSlack = resolve; });
  const writes: { table: string; data: any }[] = [];
  const backgrounds: Promise<void>[] = [];
  const from = vi.fn((table: string) => {
    let inserting = false;
    const query: any = {
      select: () => query, eq: () => query, gte: () => query,
      order: () => query, limit: () => query, single: () => query,
      insert: (data: any) => { inserting = true; writes.push({ table, data }); return query; },
      then: (resolve: (value: any) => void, reject: (error: unknown) => void) => gate.then(() => {
        if (table === "crm_columns") return { data: failure === "column" ? [] : [{ id: "entrant", name: "Entrant" }] };
        if (table === "crm_cards" && inserting) return failure === "card"
          ? { error: { message: "insert failed" } } : { data: { id: "new-card" } };
        return { data: [] };
      }).then(resolve, reject),
    };
    return query;
  });
  const report = vi.fn().mockResolvedValue(undefined);
  const slack = vi.fn(() => slackGate);
  vi.stubGlobal("Deno", { env: { get: () => "test-config" } });
  vi.stubGlobal("EdgeRuntime", { waitUntil: (promise: Promise<void>) => backgrounds.push(promise) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "Demande formation", first_name: "MARIE" }) } }] }))));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const executable = ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function("serve", "createClient", "corsHeaders", "handleCorsPreflightIfNeeded", "timingSafeEqualSecret", "reportEdgeError", "postCrmOpportunityToSlack", "logLovableUsage", "estimateOpportunityValue", "loadOpportunityValueData", "parseValueSignals", "valueSignalsPrompt", executable)(
    (fn: typeof handler) => { handler = fn; }, () => ({ from }), { "Access-Control-Allow-Origin": "*" },
    (req: Request) => req.method === "OPTIONS" ? new Response(null, { status: 204 }) : null,
    async (a: string, b: string) => a === b, report, slack, async () => {},
    () => ({ value: 150, basis: "catalogue", count: 1 }), async () => ({ catalog: [], won: [] }),
    () => ({}), () => "",
  );
  if (!handler) throw new Error("Handler non chargé");
  return { handler, release, releaseSlack, backgrounds, writes, from, report, slack };
}

function request(body = JSON.stringify({ fields: { message: "Une demande de formation" } }), token = "test-config", contentType = "application/json") {
  return new Request("http://localhost/webhook", {
    method: "POST", headers: { "x-webhook-token": token, "content-type": contentType }, body,
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Accusé de réception Elementor", () => {
  it("répond avant le traitement CRM et maintient Slack dans la tâche de fond", async () => {
    const test = setup();
    const response = await test.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, queued: true });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(test.backgrounds).toHaveLength(1);
    expect(test.writes).toEqual([]);
    let done = false;
    test.backgrounds[0].then(() => { done = true; });
    test.release();
    await vi.waitFor(() => expect(test.slack).toHaveBeenCalledTimes(1));
    expect(done).toBe(false);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data).toMatchObject({
      column_id: "entrant", title: "Demande formation", first_name: "Marie",
      estimated_value: 150, sales_status: "OPEN", acquisition_source: "site_web",
    });
    expect(test.writes.find((write) => write.table === "crm_activity_log")?.data).toMatchObject({
      card_id: "new-card", action_type: "card_created", actor_email: "system@elementor",
    });
    test.releaseSlack();
    await test.backgrounds[0];
    expect(test.report).not.toHaveBeenCalled();
  });

  it("refuse le mauvais token sans lancer de traitement", async () => {
    const test = setup();
    expect((await test.handler(request(undefined, "wrong"))).status).toBe(401);
    expect(test.backgrounds).toEqual([]);
    expect(test.from).not.toHaveBeenCalled();
  });

  it.each(["{}", "{invalid"])("refuse un payload vide ou malformé : %s", async (body) => {
    const test = setup();
    expect((await test.handler(request(body))).status).toBe(400);
    expect(test.backgrounds).toEqual([]);
    expect(test.from).not.toHaveBeenCalled();
  });

  it("accepte le format URL-encoded d'Elementor", async () => {
    const test = setup();
    const response = await test.handler(request("form_fields[message]=Bonjour", "test-config", "application/x-www-form-urlencoded"));
    expect(await response.json()).toEqual({ success: true, queued: true });
    test.release(); test.releaseSlack();
    await Promise.all(test.backgrounds);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data.raw_input).toContain("message: Bonjour");
  });

  it.each(["column", "card"] as const)("signale l'échec de fond %s sans changer l'accusé de réception", async (failure) => {
    const test = setup(failure);
    const response = await test.handler(request());
    expect(response.status).toBe(200);
    test.release();
    await Promise.all(test.backgrounds);
    expect(test.report).toHaveBeenCalledWith(expect.any(Error), { fn: "crm-elementor-webhook" });
    expect(test.slack).not.toHaveBeenCalled();
  });

  it("garde les contrôles de méthode et CORS sans tâche de fond", async () => {
    const test = setup();
    expect((await test.handler(new Request("http://localhost/webhook"))).status).toBe(405);
    expect((await test.handler(new Request("http://localhost/webhook", { method: "OPTIONS" }))).status).toBe(204);
    expect(test.backgrounds).toEqual([]);
  });
});