import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSEMBLYAI_DEFAULT_LANGUAGE, formatAssemblyAIError, isAssemblyAILanguageConfidenceError } from "./assemblyai-language.ts";

const source = readFileSync("supabase/functions/_shared/google-drive-helper.ts", "utf8");

function loadHelper() {
  const reportEdgeError = vi.fn(async () => {});
  const logAssemblyAiUsage = vi.fn(async () => {});
  const executable = ts.transpileModule(
    `${source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^export /gm, "")}\nglobalThis.__driveHelper = { submitAssemblyAIJob, pollAssemblyAIJob };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  new Function("reportEdgeError", "logAssemblyAiUsage", "logAnthropicUsage", "ASSEMBLYAI_DEFAULT_LANGUAGE", "formatAssemblyAIError", "isAssemblyAILanguageConfidenceError", executable)(
    reportEdgeError,
    logAssemblyAiUsage,
    vi.fn(async () => {}),
    ASSEMBLYAI_DEFAULT_LANGUAGE,
    formatAssemblyAIError,
    isAssemblyAILanguageConfidenceError,
  );
  return {
    helper: (globalThis as any).__driveHelper as {
      submitAssemblyAIJob: (url: string, key: string) => Promise<string>;
      pollAssemblyAIJob: (id: string, key: string) => Promise<{ text: string; duration: number } | { error: string } | null>;
    },
    reportEdgeError,
    logAssemblyAiUsage,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Langue AssemblyAI", () => {
  it("soumet les enregistrements Drive en français sans seuil de détection automatique", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "job-fr" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { helper } = loadHelper();

    await expect(helper.submitAssemblyAIJob("https://audio.invalid/file", "key")).resolves.toBe("job-fr");
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({ audio_url: "https://audio.invalid/file", language_code: "fr" });
    expect(payload).not.toHaveProperty("language_detection");
    expect(payload).not.toHaveProperty("language_confidence_threshold");
  });

  it("retourne une erreur claire pour l'ancien seuil de langue sans créer une alerte Sentry", async () => {
    const providerError = "detected language 'de', confidence 0.0373, is below the requested confidence threshold value of '0.5'";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "error", error: providerError }), { status: 200 })));
    const { helper, reportEdgeError, logAssemblyAiUsage } = loadHelper();

    const result = await helper.pollAssemblyAIJob("job-language", "key");
    expect(result).toEqual({ error: "Détection automatique de langue trop incertaine : transcription arrêtée, une reprise avec la langue française est nécessaire." });
    expect(reportEdgeError).not.toHaveBeenCalled();
    expect(logAssemblyAiUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "error", errorMessage: providerError }));
  });

  it("conserve le détail des autres erreurs fournisseur", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "error", error: "audio unreadable" }), { status: 200 })));
    const { helper, reportEdgeError } = loadHelper();

    await expect(helper.pollAssemblyAIJob("job-audio", "key")).resolves.toEqual({ error: "audio unreadable" });
    expect(reportEdgeError).toHaveBeenCalledOnce();
  });

  it("reconnaît uniquement l'erreur de seuil de langue", () => {
    expect(isAssemblyAILanguageConfidenceError("detected language 'de', confidence 0.0373, is below the requested confidence threshold value of '0.5'")).toBe(true);
    expect(isAssemblyAILanguageConfidenceError("audio unreadable")).toBe(false);
    expect(formatAssemblyAIError("audio unreadable")).toBe("audio unreadable");
  });
});
