import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/submit-drive-transcript/index.ts", "utf8");
const id = "359f1d9b-657e-44b5-89bd-fae6c343e4ad";
const nextId = "0888fa04-5df2-4f49-8f43-d746b4ae0b0a";

function setup(options: { authorized?: boolean; hold?: boolean; parts?: unknown[] } = {}) {
  const backgrounds: Promise<unknown>[] = [];
  const writes: Record<string, any>[] = [];
  let release = () => {};
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const token = vi.fn(async () => { if (options.hold) await blocked; return "test-token"; });
  const extract = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2]), start: 5400, duration: 600, expected: 6600, totalParts: 4 });
  const client = { from: () => {
    let payload: Record<string, any> | undefined;
    const query: any = {
      select: () => query, eq: () => query, is: () => query, order: () => query, limit: () => query,
      update: (value: Record<string, any>) => { payload = value; writes.push(value); return query; },
      single: async () => ({ data: { external_id: "drive-file", status: "processing", assemblyai_id: null, updated_at: "2026-11-23T17:00:00Z", metadata: { audio_parts: options.parts ?? [] } }, error: null }),
      maybeSingle: async () => ({ data: payload ? { id } : null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return query;
  } };
  vi.stubGlobal("Deno", { env: { get: () => "test-config" }, serve: (fn: unknown) => { handler = fn as typeof handler; } });
  vi.stubGlobal("EdgeRuntime", { waitUntil: (p: Promise<unknown>) => backgrounds.push(p) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 202 })));
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const executable = ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function("createClient", "corsHeaders", "handleCorsPreflightIfNeeded", "createErrorResponse", "getDriveVideoMetadata", "uploadToAssemblyAI", "getValidDriveAccessToken", "uploadDriveFileToAssemblyAI", "submitAssemblyAIJob", "isCronOrServiceRole", "reportDriveTranscriptionError", "extractDriveAudioPart", "ASSEMBLY_UPLOAD_MAX_BYTES", "ASSEMBLY_MAX_SECONDS", "z", executable)(
    () => client, {}, () => null, (message: string, status: number) => new Response(JSON.stringify({ error: message }), { status }),
    async () => ({ size: "1200000000", videoMediaMetadata: { durationMillis: "6600000" } }), async () => "upload-url", token,
    async () => "upload-url", async () => "provider-job", async () => options.authorized !== false, async () => {}, extract, 300000000, 36000, z,
  );
  if (!handler) throw new Error("Handler non chargé");
  return { handler, backgrounds, release, writes, extract, token };
}

function request(transcriptId = id) {
  return new Request("http://localhost/submit", { method: "POST", body: JSON.stringify({ transcript_id: transcriptId, drive_file_id: "drive-file" }) });
}
afterEach(() => vi.unstubAllGlobals());

describe("Soumission Drive bornée", () => {
  it("serializes uploads inside an isolate instead of exhausting memory with concurrent videos", async () => {
    const test = setup({ hold: true });
    const first = await test.handler(request());
    const second = await test.handler(request(nextId));
    expect(first.status).toBe(202);
    expect(await second.json()).toEqual({ accepted: true, queued: true, transcript_id: nextId });
    expect(test.backgrounds).toHaveLength(1);
    test.release();
    await Promise.all(test.backgrounds);
    expect(test.extract).toHaveBeenCalledTimes(1);
    expect(test.writes.at(-1)).toMatchObject({ assemblyai_id: "provider-job", metadata: { upload_lease_until: null, submission_stage: "transcribing" } });
  });
  it("resumes after two completed 45-minute parts and keeps their text", async () => {
    const parts = [0, 1].map((index) => ({ index, start: index * 2700, duration: 2700, actual_duration: 2700, text: `saved ${index}`, job_id: `j${index}` }));
    const test = setup({ parts });
    await test.handler(request());
    await Promise.all(test.backgrounds);
    expect(test.extract).toHaveBeenCalledWith("drive-file", "test-token", 1200000000, 2, 5400);
    expect(test.writes.at(-1)?.metadata.audio_parts.slice(0, 2)).toEqual(parts);
    expect(test.writes.at(-1)?.metadata.audio_parts[2]).toMatchObject({ index: 2, duration: 600, job_id: "provider-job" });
  });
  it("rejects callers without internal authorization before any upload or write", async () => {
    const test = setup({ authorized: false });
    expect((await test.handler(request())).status).toBe(401);
    expect(test.writes).toEqual([]);
    expect(test.extract).not.toHaveBeenCalled();
    expect(test.token).not.toHaveBeenCalled();
  });
});