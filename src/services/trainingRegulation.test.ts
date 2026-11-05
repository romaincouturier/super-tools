import { describe, it, expect, vi, beforeEach } from "vitest";
const invoke = vi.fn();
const rpc = vi.fn();
const inQuery = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) }, rpc: (...args: unknown[]) => rpc(...args), from: () => ({ select: () => ({ in: (...args: unknown[]) => inQuery(...args) }) }) } }));
import { publishRegulation, loadTrainingRegulation, prepareRegulationDownload } from "./trainingRegulation";
beforeEach(() => { vi.clearAllMocks(); });
describe("publication du règlement", () => {
  it("ne publie jamais après un échec d'upload", async () => {
    invoke.mockResolvedValue({ error: new Error("Upload refusé") });
    await expect(publishRegulation("Texte", new Blob(["pdf"]), "ancien.pdf")).rejects.toThrow("Upload refusé");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("conserve une erreur de publication sans annoncer de succès", async () => {
    invoke.mockResolvedValue({ data: { publicUrl: "nouveau.pdf" } });
    rpc.mockResolvedValue({ error: new Error("Conflit") });
    await expect(publishRegulation("Texte", new Blob(["pdf"]), "ancien.pdf")).rejects.toThrow("Conflit");
    expect(inQuery).not.toHaveBeenCalled();
  });
  it("distingue un brouillon vide d'un brouillon absent", async () => {
    inQuery.mockResolvedValue({ data: [{ setting_key: "reglement_interieur_draft", setting_value: "" }] });
    expect(await loadTrainingRegulation()).toMatchObject({ draft: "", hasDraft: true });
    inQuery.mockResolvedValue({ data: [] });
    expect(await loadTrainingRegulation()).toMatchObject({ hasDraft: false });
  });
});

describe("téléchargement du règlement", () => {
  it("prépare un vrai PDF non vide avant le clic", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("%PDF-test", { headers: { "Content-Type": "application/pdf" } }));
    const blob = await prepareRegulationDownload("https://example.test/reglement.pdf");
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(9);
    vi.restoreAllMocks();
  });
  it("refuse une réponse HTML ou un fichier absent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>Erreur</html>", { headers: { "Content-Type": "text/html" } }));
    await expect(prepareRegulationDownload("https://example.test/reglement.pdf")).rejects.toThrow("n'est pas un PDF");
    fetchMock.mockResolvedValue(new Response("Introuvable", { status: 404 }));
    await expect(prepareRegulationDownload("https://example.test/reglement.pdf")).rejects.toThrow("n'est pas disponible");
    vi.restoreAllMocks();
  });
});