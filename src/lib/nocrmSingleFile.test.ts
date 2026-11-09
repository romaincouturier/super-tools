import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { prepareNocrmFile } from "./nocrmSingleFile";

describe("Export noCRM unique", () => {
  it("extrait toutes les colonnes de commentaires, y compris au-delà de l'en-tête", async () => {
    const csv = 'Lead;ID;Comment 1;Comment 2;Comment 3;...\nTest;42;[2020-01-30 15:28]  Note;[2020-01-22 11:41] E-mail reçu Réponse;;;[2020-02-01 10:00]  Dernière note';
    const result = await prepareNocrmFile({ arrayBuffer: async () => new TextEncoder().encode(csv).buffer } as File);
    const comments = Papa.parse<Record<string, string>>(result.commentsCsv, { header: true }).data;
    expect(comments).toHaveLength(3);
    expect(comments[0]).toEqual({ nocrm_id: "42", commented_at: "2020-01-30 15:28", activity_type: "", content: "Note", is_note: "True" });
    expect(comments[1].activity_type).toBe("E-mail reçu");
    expect(comments[1].is_note).toBe("False");
    expect(comments[2].content).toBe("Dernière note");
    expect(Papa.parse(result.leadsCsv).data).toEqual([["Lead", "ID"], ["Test", "42"]]);
  });
  it("conserve les accents de l'export Windows", async () => {
    const bytes = Uint8Array.from([...new TextEncoder().encode('Lead;ID;Comment 1\n'), 0xc9, ...new TextEncoder().encode('quipe;1;')]);
    const result = await prepareNocrmFile({ arrayBuffer: async () => bytes.buffer } as File);
    expect(result.leadsCsv).toContain("Équipe");
  });
  it("refuse un commentaire non reconnu au lieu de le perdre", async () => {
    await expect(prepareNocrmFile({ arrayBuffer: async () => new TextEncoder().encode('ID;Comment 1\n42;invalide').buffer } as File)).rejects.toThrow("42");
  });
});