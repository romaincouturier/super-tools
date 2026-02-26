import { describe, it, expect, vi } from "vitest";

// Mock Supabase client (loaded at module top-level by useCrmEmailTemplates)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

const { replaceCrmVariables } = await import("./useCrmEmailTemplates");

describe("replaceCrmVariables", () => {
  // ═══════════════════════════════════════════════════════════════════
  // Syntaxe simple : {{variable}}
  // ═══════════════════════════════════════════════════════════════════

  describe("simple variable replacement", () => {
    it("replaces a single variable", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom}}", { nom: "Alice" }),
      ).toBe("Bonjour Alice");
    });

    it("replaces multiple variables", () => {
      expect(
        replaceCrmVariables("{{prenom}} {{nom}} - {{entreprise}}", {
          prenom: "Alice",
          nom: "Dupont",
          entreprise: "Acme",
        }),
      ).toBe("Alice Dupont - Acme");
    });

    it("replaces missing variable with empty string", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom}}", {}),
      ).toBe("Bonjour ");
    });

    it("replaces null variable with empty string", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom}}", { nom: null }),
      ).toBe("Bonjour ");
    });

    it("replaces undefined variable with empty string", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom}}", { nom: undefined }),
      ).toBe("Bonjour ");
    });

    it("returns template unchanged when no placeholders", () => {
      expect(
        replaceCrmVariables("Hello world", { nom: "Alice" }),
      ).toBe("Hello world");
    });

    it("handles empty template", () => {
      expect(replaceCrmVariables("", { nom: "Alice" })).toBe("");
    });

    it("handles same variable used multiple times", () => {
      expect(
        replaceCrmVariables("{{nom}} et {{nom}}", { nom: "Alice" }),
      ).toBe("Alice et Alice");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Syntaxe fallback : {{variable||valeur_par_defaut}}
  // ═══════════════════════════════════════════════════════════════════

  describe("fallback syntax {{var||default}}", () => {
    it("uses the variable value when present", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom||Monsieur}}", { nom: "Alice" }),
      ).toBe("Bonjour Alice");
    });

    it("uses the fallback when variable is missing", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom||Monsieur}}", {}),
      ).toBe("Bonjour Monsieur");
    });

    it("uses the fallback when variable is null", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom||Monsieur}}", { nom: null }),
      ).toBe("Bonjour Monsieur");
    });

    it("uses the fallback when variable is empty string", () => {
      expect(
        replaceCrmVariables("Bonjour {{nom||Monsieur}}", { nom: "" }),
      ).toBe("Bonjour Monsieur");
    });

    it("handles fallback with spaces", () => {
      expect(
        replaceCrmVariables("{{titre||Cher client}}", {}),
      ).toBe("Cher client");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Syntaxe conditionnelle : {{variable? contenu {{inner}}}}
  // ═══════════════════════════════════════════════════════════════════

  describe("conditional syntax {{var? content}}", () => {
    it("includes conditional block when variable has value", () => {
      expect(
        replaceCrmVariables("Bonjour{{entreprise? de {{entreprise}}}}", {
          entreprise: "Acme",
        }),
      ).toBe("Bonjour de Acme");
    });

    it("removes conditional block when variable is missing", () => {
      expect(
        replaceCrmVariables("Bonjour{{entreprise? de {{entreprise}}}}", {}),
      ).toBe("Bonjour");
    });

    it("removes conditional block when variable is null", () => {
      expect(
        replaceCrmVariables("Texte{{note? (note: {{note}})}}", { note: null }),
      ).toBe("Texte");
    });

    it("removes conditional block when variable is empty string", () => {
      expect(
        replaceCrmVariables("Texte{{note? (note: {{note}})}}", { note: "" }),
      ).toBe("Texte");
    });

    it("replaces inner variables within conditional block", () => {
      // Note: space after ? is part of the content (not stripped)
      expect(
        replaceCrmVariables(
          "{{contact? Votre contact : {{prenom}} {{nom}}}}",
          { contact: "oui", prenom: "Alice", nom: "Dupont" },
        ),
      ).toBe(" Votre contact : Alice Dupont");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Combinaisons des 3 syntaxes
  // ═══════════════════════════════════════════════════════════════════

  describe("combined syntax", () => {
    it("handles all three syntaxes in one template", () => {
      // Space after ? is preserved in output (it's content, not a separator)
      const template =
        "Bonjour {{titre||Madame, Monsieur}},\n" +
        "{{entreprise? Concernant {{entreprise}}, }}voici notre proposition pour {{projet}}.";

      const result = replaceCrmVariables(template, {
        titre: "M. Dupont",
        entreprise: "Acme Corp",
        projet: "refonte site",
      });

      expect(result).toBe(
        "Bonjour M. Dupont,\n" +
        " Concernant Acme Corp, voici notre proposition pour refonte site.",
      );
    });

    it("handles all three with missing values", () => {
      const template =
        "Bonjour {{titre||Madame, Monsieur}},\n" +
        "{{entreprise? Concernant {{entreprise}}, }}voici notre proposition.";

      const result = replaceCrmVariables(template, {});

      expect(result).toBe(
        "Bonjour Madame, Monsieur,\n" +
        "voici notre proposition.",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles variable with numeric value", () => {
      // Variables are string | undefined | null, but let's verify string numbers work
      expect(
        replaceCrmVariables("Montant: {{montant}} EUR", { montant: "1500" }),
      ).toBe("Montant: 1500 EUR");
    });

    it("handles template with HTML content", () => {
      expect(
        replaceCrmVariables("<p>Bonjour {{nom}}</p>", { nom: "Alice" }),
      ).toBe("<p>Bonjour Alice</p>");
    });

    it("handles variable value containing curly braces", () => {
      // Value contains {{ but should be treated as literal text after replacement
      expect(
        replaceCrmVariables("{{code}}", { code: "function() { return {}; }" }),
      ).toBe("function() { return {}; }");
    });
  });
});
