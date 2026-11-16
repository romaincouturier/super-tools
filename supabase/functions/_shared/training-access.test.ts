import { describe, it, expect, vi } from "vitest";
import { resolveTrainingAccess, findMissingTrainingAccess, includeAccessInstructions, accessInstructionsHtml, fetchAccessVenues } from "./training-access";
import { DEFAULT_TEMPLATES } from "../../../src/components/settings/settingsConstants";

vi.mock("./resend.ts", () => ({ escapeHtml: (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;") }));
const { processTemplate, templateTextToHtml } = await import("./templates");
const venue = { id: "venue", name: "Agile Tribu", address: "4ter Pass. de la Main d'Or", postal_code: "75011", city: "Paris", access_instructions: "Digicode 1234\n2e étage, interphone Tribu" };
const training = { id: "session", training_name: "FG", start_date: "2026-11-16", session_format: "presentiel", venue_id: "venue" };

describe("instructions d’accès", () => {
  it("hérite du lieu", () => expect(resolveTrainingAccess(training, [venue])).toBe(venue.access_instructions));
  it("préfère la surcharge de session", () => expect(resolveTrainingAccess({ ...training, access_instructions: " Entrée B " }, [venue])).toBe("Entrée B"));
  it("hérite lorsque la surcharge est vide", () => expect(resolveTrainingAccess({ ...training, access_instructions: "  " }, [venue])).toBe(venue.access_instructions));
  it("retrouve un lieu legacy par adresse exacte unique", () => expect(resolveTrainingAccess({ ...training, venue_id: null, location: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" }, [venue])).toBe(venue.access_instructions));
  it("ne devine pas un lieu par son nom seul", () => expect(resolveTrainingAccess({ ...training, venue_id: null, location: "Agile Tribu" }, [venue])).toBe(""));
  it("ne choisit pas entre deux adresses identiques", () => expect(resolveTrainingAccess({ ...training, venue_id: null, location: "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris" }, [venue, { ...venue, id: "other" }])).toBe(""));
  it.each(["distanciel_synchrone", "distanciel_asynchrone"])("masque les instructions en %s", session_format => expect(resolveTrainingAccess({ ...training, session_format, access_instructions: "Entrée B" }, [venue])).toBe(""));
  it("n’affiche aucun bloc vide", () => expect(includeAccessInstructions("<p>Bonjour</p>", " ")).toBe("<p>Bonjour</p>"));
  it("échappe le texte libre et conserve les lignes", () => expect(accessInstructionsHtml("<script>\nEntrée B")).toBe("<p><strong>Instructions d'accès</strong><br>&lt;script&gt;<br>Entrée B</p>"));
  it("signale aujourd’hui et J+6 mais pas J+7 ou hier", () => {
    const rows = ["2026-11-15", "2026-11-16", "2026-11-22", "2026-11-23"].map(start_date => ({ ...training, start_date }));
    expect(findMissingTrainingAccess(rows, [], "2026-11-16").map(t => t.start_date)).toEqual(["2026-11-16", "2026-11-22"]);
  });
  it("exclut une session annulée", () => expect(findMissingTrainingAccess([{ ...training, is_cancelled: true }], [], "2026-11-16")).toEqual([]));
  it("exclut une session en visio", () => expect(findMissingTrainingAccess([{ ...training, session_format: "distanciel_synchrone" }], [], "2026-11-16")).toEqual([]));
  it("résout l’alerte après saisie au lieu", () => expect(findMissingTrainingAccess([training], [venue], "2026-11-16")).toEqual([]));
  it("résout l’alerte après saisie à la session", () => expect(findMissingTrainingAccess([{ ...training, access_instructions: "Entrée B" }], [], "2026-11-16")).toEqual([]));
  it("propage une erreur de lecture au lieu d’inventer un manque", async () => {
    const error = new Error("refus");
    await expect(fetchAccessVenues({ from: () => ({ select: async () => ({ error }) }) })).rejects.toThrow("refus");
  });
});

describe("instructions dans les mails participants", () => {
  it.each(["welcome", "reminder"])("insère les instructions dans %s tu et vous", type => {
    for (const suffix of ["tu", "vous"] as const) {
      const definition = DEFAULT_TEMPLATES[type];
      const html = includeAccessInstructions(templateTextToHtml(processTemplate(definition.content[suffix], { training_location: "Paris" }, false)), resolveTrainingAccess(training, [venue]));
      expect(html).toContain("Digicode 1234<br>2e étage, interphone Tribu");
      expect(html).toContain("Instructions d'accès");
    }
  });
  it("insère les instructions dans le mail du jour", () => {
    const html = includeAccessInstructions("<p>C'est aujourd'hui</p><ul><li>Lieu : Paris</li><li>9h–17h</li></ul>", resolveTrainingAccess(training, [venue]));
    expect(html).toContain("</ul><p><strong>Instructions d'accès</strong><br>Digicode 1234");
  });
  it("un modèle personnalisé peut placer le bloc", () => {
    const html = processTemplate("Bonjour {{access_instructions}}", { access_instructions: accessInstructionsHtml(venue.access_instructions) }, false);
    expect(html).toContain("Bonjour <p><strong>Instructions d'accès</strong><br>Digicode 1234");
  });
});