import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync("supabase/functions/generate-transcript-content/index.ts", "utf8");

function setup(content: unknown[]) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-test" } } }) },
    from: (table: string) => {
      let payload: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: () => query,
        insert: (value: Record<string, unknown>) => { payload = value; return query; },
        maybeSingle: async () => ({ data: { setting_value: ["intelligence collective"] } }),
        single: async () => {
          if (table === "transcripts") return { data: { id: "transcript-test", title: "Réunion", raw_text: "Texte de la réunion" } };
          if (table === "transcript_ai_prompts") return { data: { system_prompt: "Consigne personnalisée", user_prompt_template: "{{transcript}}", model: "configured-model" } };
          if (payload) { inserted.push(payload); return { data: { id: "generation-test", ...payload } }; }
          throw new Error(`Table inattendue : ${table}`);
        },
      };
      return query;
    },
  };
  const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (body.tool_choice.type !== "auto") {
      return new Response(JSON.stringify({ error: { message: 'tool_choice: type "tool" and "any" are not supported for this model.' } }), { status: 400 });
    }
    return new Response(JSON.stringify({ content, stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 20 } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Deno", { env: { get: () => "test-key" } });
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const usage = vi.fn().mockResolvedValue(undefined);
  const executable = ts.transpileModule(source.replace(/^import .*;\n/gm, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  new Function("serve", "corsHeaders", "handleCorsPreflightIfNeeded", "getSupabaseClient", "logAnthropicUsage", "CLAUDE_ADVANCED", executable)(
    (fn: typeof handler) => { handler = fn; }, {}, () => null, () => client, usage, "fallback-model",
  );
  if (!handler) throw new Error("Handler non chargé");
  return { handler, fetchMock, inserted, usage };
}

afterEach(() => vi.unstubAllGlobals());

describe("Génération de contenus depuis un transcript", () => {
  it.each(["blog_article", "linkedin_post"])("accepte le modèle sans appel forcé et enregistre les propositions %s", async (kind) => {
    const variants = [1, 2, 3].map((n) => ({ title: `Titre ${n}`, content: `Contenu ${n}` }));
    const { handler, fetchMock, inserted, usage } = setup([
      { type: "text", text: "Je prépare les propositions." },
      { type: "tool_use", name: "propose_content", input: { variants, tags: ["intelligence collective"] } },
    ]);
    const response = await handler(new Request("http://localhost/generate", {
      method: "POST", headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify({ transcript_id: "transcript-test", kind, force: true }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).generation.variants).toEqual(variants);
    expect(inserted).toEqual([expect.objectContaining({ kind, model: "configured-model", variants, created_by: "staff-test" })]);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(requestBody.tool_choice).toEqual({ type: "auto" });
    expect(requestBody.system).toContain("Consigne personnalisée");
    expect(requestBody.system).toContain("appelle obligatoirement l'outil propose_content");
    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ model: "configured-model", operation: kind }));
  });

  it.each([
    [{ type: "text", text: "Réponse libre sans outil" }],
    [{ type: "tool_use", name: "autre_outil", input: { content: "Ne pas enregistrer" } }],
  ])("ne sauvegarde pas une réponse sans le bon outil", async (...args) => {
    const { handler, inserted } = setup(args);
    const response = await handler(new Request("http://localhost/generate", {
      method: "POST", headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify({ transcript_id: "transcript-test", kind: "blog_article", force: true }),
    }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Réponse IA invalide" });
    expect(inserted).toEqual([]);
  });
});