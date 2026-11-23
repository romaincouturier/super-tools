import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/poll-drive-testimonials/index.ts", "utf8");
function setup(existing: unknown, status = 202) {
  const writes: Record<string, unknown>[] = [];
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: existing }), single: async () => ({ data: { id: "recording" } }), insert: (value: Record<string, unknown>) => { writes.push(value); return query; }, update: (value: Record<string, unknown>) => { writes.push(value); return query; }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status }));
  vi.stubGlobal("fetch", fetchMock);
  const start = source.indexOf("    const enqueueTranscript =");
  const end = source.indexOf("    // ── Pass 0", start);
  const executable = ts.transpileModule(source.slice(start, end) + "\nreturn enqueueTranscript;", { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const enqueue = new Function("admin", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", executable)({ from: () => query }, "http://localhost", "test-internal");
  return { enqueue, writes, fetchMock };
}
afterEach(() => vi.unstubAllGlobals());
describe("Enregistrements redirigés depuis le dossier témoignages", () => {
  it.each(["ready", "trashed", "processing", "error"])("preserves %s records without resubmitting or resetting progress", async (status) => {
    const test = setup({ id: "recording", status, assemblyai_id: null });
    expect(await test.enqueue("drive", "meeting.mp4")).toBe(true);
    expect(test.writes).toEqual([]);
    expect(test.fetchMock).not.toHaveBeenCalled();
  });
  it("persists the shared queue marker for a new recording", async () => {
    const test = setup(null);
    expect(await test.enqueue("drive", "meeting.mp4")).toBe(true);
    expect(test.writes[0]).toMatchObject({ status: "processing", metadata: { submission_stage: "queued" } });
  });
  it("records submission failure instead of reporting success", async () => {
    const test = setup(null, 500);
    expect(await test.enqueue("drive", "meeting.mp4")).toBe(false);
    expect(test.writes.at(-1)).toEqual({ status: "error", error_message: "Soumission Drive HTTP 500" });
  });
});