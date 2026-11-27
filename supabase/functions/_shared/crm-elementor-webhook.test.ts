// @vitest-environment node
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/crm-elementor-webhook/index.ts", "utf8");

function setup(failure?: "column" | "card" | "inbox" | "duplicate" | "merge" | "known" | "activity") {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let releaseSlack: () => void = () => {};
  const slackGate = new Promise<void>((resolve) => { releaseSlack = resolve; });
  const writes: { table: string; data: any }[] = [];
  const saved = new Map<string, any>();
  const backgrounds: Promise<void>[] = [];
  const from = vi.fn((table: string) => {
    let inserting = false;
    let update: any;
    let isDuplicateLookup = false;
    let inserted: any;
    let selected: string;
    const query: any = {
      select: (columns: string) => { selected = columns; return query; }, eq: () => query, gte: () => { isDuplicateLookup = true; return query; },
      order: () => query, limit: () => query, single: () => query,
      insert: (data: any) => { inserting = true; inserted = data; writes.push({ table, data }); return query; },
      update: (data: any) => { update = data; writes.push({ table, data }); return query; },
      then: (resolve: (value: any) => void, reject: (error: unknown) => void) => (table === "elementor_webhook_inbox" ? Promise.resolve() : gate).then(() => {
        if (table === "elementor_webhook_inbox") {
          if (inserting) {
            if (failure === "inbox") return { error: { message: "inbox unavailable" } };
            saved.set("inbox-id", { id: "inbox-id", status: "received", ...inserted });
            return { data: { id: "inbox-id" } };
          }
          saved.set("inbox-id", { ...saved.get("inbox-id"), ...update });
          return { error: null };
        }
        if (table === "crm_cards" && isDuplicateLookup && (failure === "duplicate" || failure === "merge")) {
          return { data: [{ id: "existing-card", description_html: "<p>Historique</p>", raw_input: "Ancien formulaire" }] };
        }
        if (table === "crm_cards" && update && failure === "merge") return { error: { message: "merge failed" } };
        if (table === "crm_cards" && selected === "id" && failure === "known") return { data: [{ id: "closed-card" }] };
        if (table === "crm_activity_log" && failure === "activity") return { error: { message: "activity failed" } };
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
  return { handler, release, releaseSlack, backgrounds, writes, from, report, slack, saved };
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
    const started = performance.now();
    const response = await test.handler(request());
    expect(performance.now() - started).toBeLessThan(1000);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(test.backgrounds).toHaveLength(1);
    expect(test.writes.filter((write) => write.table !== "elementor_webhook_inbox")).toEqual([]);
    expect(test.saved.get("inbox-id")).toMatchObject({ status: "received", submission: {
      raw_payload: JSON.stringify({ fields: { message: "Une demande de formation" } }),
      content_type: "application/json", normalized: { fields: [{ id: "message", title: "message", value: "Une demande de formation" }] },
    } });
    let done = false;
    test.backgrounds[0].then(() => { done = true; });
    test.release();
    await vi.waitFor(() => expect(test.slack).toHaveBeenCalledTimes(1));
    expect(done).toBe(false);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data).toMatchObject({
      column_id: "entrant", title: "Demande formation", first_name: "Marie",
      estimated_value: 150, sales_status: "OPEN", acquisition_source: "site_web",
      source_metadata: {
        received_at: test.saved.get("inbox-id").received_at,
        page_url: null, page_title: null, user_agent: null, referrer: null,
        remote_ip: null, form_name: null, form_id: null, channel: "elementor_webhook",
        value_estimation: { value: 150, basis: "catalogue", count: 1 },
      },
    });
    expect(test.writes.find((write) => write.table === "crm_activity_log")?.data).toMatchObject({
      card_id: "new-card", action_type: "card_created", actor_email: "system@elementor",
    });
    test.releaseSlack();
    await test.backgrounds[0];
    expect(test.saved.get("inbox-id")).toMatchObject({ status: "processed", card_id: "new-card", error_message: null });
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
    expect(await response.json()).toEqual({ ok: true });
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
    expect(test.report).toHaveBeenCalledWith(expect.any(Error), { fn: "crm-elementor-webhook", inbox_id: "inbox-id" });
    expect(test.saved.get("inbox-id")).toMatchObject({ status: "error", error_message: expect.any(String), submission: {
      raw_payload: JSON.stringify({ fields: { message: "Une demande de formation" } }),
    } });
    expect(test.slack).not.toHaveBeenCalled();
  });

  it("garde les contrôles de méthode et CORS sans tâche de fond", async () => {
    const test = setup();
    expect((await test.handler(new Request("http://localhost/webhook"))).status).toBe(405);
    expect((await test.handler(new Request("http://localhost/webhook", { method: "OPTIONS" }))).status).toBe(204);
    expect(test.backgrounds).toEqual([]);
  });

  it("ne confirme jamais un formulaire qui n'a pas pu être conservé", async () => {
    const test = setup("inbox");
    expect((await test.handler(request())).status).toBe(503);
    expect(test.backgrounds).toEqual([]);
    expect(test.saved.size).toBe(0);
    expect(test.report).toHaveBeenCalledWith(expect.any(Error), { fn: "crm-elementor-webhook", stage: "receipt" });
  });

  it("crée normalement les fiches avec l'adresse de test autorisée", async () => {
    const test = setup();
    const response = await test.handler(request(JSON.stringify({ fields: { email: "romain+test-formulaire@supertilt.fr", message: "Test autorisé" } })));
    expect(await response.json()).toEqual({ ok: true });
    test.release(); test.releaseSlack();
    await Promise.all(test.backgrounds);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data).toMatchObject({ email: "romain+test-formulaire@supertilt.fr", acquisition_source: "site_web" });
  });

  it.each(["duplicate", "merge"] as const)("conserve et relie les soumissions en doublon, même en cas d'échec : %s", async (failure) => {
    const test = setup(failure);
    expect((await test.handler(request(JSON.stringify({ fields: { email: "test@example.invalid", message: "Autre demande" } })))).status).toBe(200);
    test.release();
    await Promise.all(test.backgrounds);
    expect(test.saved.get("inbox-id")).toMatchObject({ card_id: "existing-card", status: failure === "merge" ? "error" : "processed" });
    expect(test.slack).not.toHaveBeenCalled();
  });

  it("conserve aussi le multipart brut et les métadonnées HTTP sans enrichir la fiche autrement", async () => {
    const test = setup();
    const form = new FormData();
    form.set("fields[message][title]", "Demande"); form.set("fields[message][value]", "Bonjour multipart");
    const response = await test.handler(new Request("http://localhost/webhook?token=test-config", {
      method: "POST", body: form, headers: { "user-agent": "Elementor", "x-forwarded-for": "192.0.2.1, 192.0.2.2", referer: "https://supertilt.fr/contact" },
    }));
    expect(await response.json()).toEqual({ ok: true });
    expect(test.saved.get("inbox-id").submission.raw_payload).toContain("Bonjour multipart");
    test.release(); test.releaseSlack();
    await Promise.all(test.backgrounds);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data.source_metadata).toMatchObject({ user_agent: "Elementor", remote_ip: "192.0.2.1", referrer: "https://supertilt.fr/contact" });
  });

  it("préserve le repli JSON ou URL-encoded sans type explicite", async () => {
    const test = setup();
    const response = await test.handler(request("form_fields[message]=Bonjour", "test-config", "text/plain"));
    expect(await response.json()).toEqual({ ok: true });
    test.release(); test.releaseSlack();
    await Promise.all(test.backgrounds);
    expect(test.saved.get("inbox-id").submission.raw_payload).toBe("form_fields[message]=Bonjour");
  });

  it("garde site_web même si l'adresse du contact existe déjà dans le CRM", async () => {
    const test = setup("known");
    const response = await test.handler(request(JSON.stringify({ fields: { email: "romain+test-formulaire@supertilt.fr", message: "Nouvelle demande" } })));
    expect(await response.json()).toEqual({ ok: true });
    test.release(); test.releaseSlack();
    await Promise.all(test.backgrounds);
    expect(test.writes.find((write) => write.table === "crm_cards")?.data.acquisition_source).toBe("site_web");
  });

  it("conserve l'identifiant de la fiche si une étape suivant sa création échoue", async () => {
    const test = setup("activity");
    expect((await test.handler(request())).status).toBe(200);
    test.release();
    await Promise.all(test.backgrounds);
    expect(test.saved.get("inbox-id")).toMatchObject({ status: "error", card_id: "new-card", error_message: "Failed to log Elementor submission: activity failed" });
    expect(test.report).toHaveBeenCalledWith(expect.any(Error), { fn: "crm-elementor-webhook", inbox_id: "inbox-id" });
  });
});