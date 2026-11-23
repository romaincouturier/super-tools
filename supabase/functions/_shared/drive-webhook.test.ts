import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/assemblyai-webhook/index.ts", "utf8");
const id = "359f1d9b-657e-44b5-89bd-fae6c343e4ad";

function setup(status = 200) {
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id, source: "google_drive", external_id: "drive", metadata: { audio_parts: [{ index: 0 }] } } }) };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: status === 200 }), { status }));
  const report = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);
  let handler: ((req: Request) => Promise<Response>) | undefined;
  vi.stubGlobal("Deno", { env: { get: () => "test-config" }, serve: (fn: typeof handler) => { handler = fn; } });
  const executable = ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function("createClient", "corsHeaders", "handleCorsPreflightIfNeeded", "timingSafeEqualSecret", "reportEdgeError", executable)(
    () => ({ from: () => query }), {}, () => null, async (a: string, b: string) => a === b, report,
  );
  if (!handler) throw new Error("Handler non chargé");
  return { handler, fetchMock, report };
}
function request(secret = "test-config") {
  return new Request("http://localhost/webhook", { method: "POST", headers: { "x-webhook-secret": secret }, body: JSON.stringify({ transcript_id: "provider-job", status: "completed" }) });
}
afterEach(() => vi.unstubAllGlobals());

describe("Finalisation des morceaux Drive", () => {
  it("finalizes only the completed recording immediately instead of waiting for the hourly poll", async () => {
    const test = setup();
    const response = await test.handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, part_processed: true });
    expect(test.fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(test.fetchMock.mock.calls[0][1].body)).toEqual({ only_transcript_id: id });
    expect(test.fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-config");
  });
  it("does not claim success when the part cannot be finalized", async () => {
    const test = setup(500);
    const response = await test.handler(request());
    expect(response.status).toBe(502);
    expect((await response.json()).ok).toBe(false);
    expect(test.report).toHaveBeenCalledWith(expect.any(Error), { fn: "assemblyai-webhook", transcript_id: id });
  });
  it("rejects a webhook without the correct secret before any follow-up call", async () => {
    const test = setup();
    expect((await test.handler(request("wrong"))).status).toBe(401);
    expect(test.fetchMock).not.toHaveBeenCalled();
  });
});