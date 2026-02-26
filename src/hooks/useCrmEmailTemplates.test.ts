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

    it("handles empty variables record", () => {
      expect(replaceCrmVariables("{{a}} {{b}} {{c}}", {})).toBe("  ");
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

    it("handles multiple fallbacks in same template", () => {
      expect(
        replaceCrmVariables(
          "{{titre||M.}} {{nom||Client}} de {{ville||Paris}}",
          { nom: "Dupont" },
        ),
      ).toBe("M. Dupont de Paris");
    });

    it("handles empty fallback value", () => {
      expect(
        replaceCrmVariables("Test{{suffix||}}", {}),
      ).toBe("Test");
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

    it("handles conditional with no inner variable references", () => {
      expect(
        replaceCrmVariables("{{show?Texte visible}}", { show: "oui" }),
      ).toBe("Texte visible");
    });

    it("removes conditional when trigger var is present but inner var is missing", () => {
      expect(
        replaceCrmVariables(
          "{{show?Info: {{detail}}}}",
          { show: "oui" },
        ),
      ).toBe("Info: ");
    });

    it("handles multiple conditional blocks", () => {
      const template = "A{{x?-X}}B{{y?-Y}}C";
      expect(replaceCrmVariables(template, { x: "1" })).toBe("A-XBC");
      expect(replaceCrmVariables(template, { y: "1" })).toBe("AB-YC");
      expect(replaceCrmVariables(template, { x: "1", y: "1" })).toBe("A-XB-YC");
      expect(replaceCrmVariables(template, {})).toBe("ABC");
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

    it("processes in correct order: conditional > fallback > simple", () => {
      // Conditional is processed first, then fallback, then simple
      const template = "{{flag?OK }} {{name||inconnu}} {{role}}";
      expect(
        replaceCrmVariables(template, { flag: "1", name: "Alice", role: "dev" }),
      ).toBe("OK  Alice dev");
      expect(
        replaceCrmVariables(template, {}),
      ).toBe(" inconnu ");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Edge cases & limites
  // ═══════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("handles variable with numeric value", () => {
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
      expect(
        replaceCrmVariables("{{code}}", { code: "function() { return {}; }" }),
      ).toBe("function() { return {}; }");
    });

    it("ignores malformed placeholders (no closing braces)", () => {
      expect(
        replaceCrmVariables("{{nom", { nom: "Alice" }),
      ).toBe("{{nom");
    });

    it("ignores malformed placeholders (single brace)", () => {
      expect(
        replaceCrmVariables("{nom}", { nom: "Alice" }),
      ).toBe("{nom}");
    });

    it("handles very long variable names", () => {
      const longName = "a".repeat(100);
      expect(
        replaceCrmVariables(`{{${longName}}}`, { [longName]: "value" }),
      ).toBe("value");
    });

    it("handles multiline template", () => {
      const template = "Ligne 1: {{a}}\nLigne 2: {{b}}\nLigne 3: {{c}}";
      expect(
        replaceCrmVariables(template, { a: "A", b: "B", c: "C" }),
      ).toBe("Ligne 1: A\nLigne 2: B\nLigne 3: C");
    });

    it("handles unicode in variable values", () => {
      expect(
        replaceCrmVariables("{{msg}}", { msg: "Bonjour les élèves ! 🎓" }),
      ).toBe("Bonjour les élèves ! 🎓");
    });

    it("handles special regex characters in fallback values", () => {
      expect(
        replaceCrmVariables("{{name||$100 (USD)}}", {}),
      ).toBe("$100 (USD)");
    });

    it("handles variable name with underscores and digits", () => {
      expect(
        replaceCrmVariables("{{var_1}} {{item2_name}}", {
          var_1: "a",
          item2_name: "b",
        }),
      ).toBe("a b");
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Intégration : template email CRM réaliste
  // ═══════════════════════════════════════════════════════════════════

  describe("realistic CRM email templates", () => {
    it("renders a full prospection email", () => {
      const template = [
        "Bonjour {{titre||Madame, Monsieur}},",
        "",
        "{{entreprise?Je me permets de vous contacter concernant {{entreprise}}.}}",
        "",
        "Suite à notre {{canal||échange}}, je souhaitais vous présenter notre offre {{offre}}.",
        "",
        "{{montant?Le montant estimé est de {{montant}} HT.}}",
        "",
        "Cordialement,",
        "{{signature||L'équipe commerciale}}",
      ].join("\n");

      const result = replaceCrmVariables(template, {
        titre: "M. Martin",
        entreprise: "TechCorp",
        offre: "formation React",
        montant: "3 500€",
        signature: "Romain Couturier",
      });

      expect(result).toContain("M. Martin");
      expect(result).toContain("TechCorp");
      expect(result).toContain("formation React");
      expect(result).toContain("3 500€ HT");
      expect(result).toContain("Romain Couturier");
      // Default fallback for canal
      expect(result).toContain("échange");
    });

    it("renders same template with minimal data", () => {
      const template = [
        "Bonjour {{titre||Madame, Monsieur}},",
        "{{entreprise?Concernant {{entreprise}}, }}voici notre proposition {{offre||de service}}.",
        "{{montant?Budget: {{montant}}.}}",
        "Cordialement, {{signature||L'équipe}}",
      ].join("\n");

      const result = replaceCrmVariables(template, {});

      expect(result).toContain("Madame, Monsieur");
      expect(result).not.toContain("Concernant");
      expect(result).toContain("de service");
      expect(result).not.toContain("Budget");
      expect(result).toContain("L'équipe");
    });

    it("handles convention email template with participant data", () => {
      const template =
        "{{civilite||}} {{prenom}} {{nom}},\n" +
        "Votre formation «{{formation}}» débutera le {{date}}.\n" +
        "{{lieu?Lieu : {{lieu}}\n}}" +
        "{{horaires?Horaires : {{horaires}}\n}}";

      const full = replaceCrmVariables(template, {
        civilite: "Mme",
        prenom: "Sophie",
        nom: "Bernard",
        formation: "Management Agile",
        date: "15 mars 2024",
        lieu: "Paris - La Défense",
        horaires: "9h00-17h30",
      });

      expect(full).toContain("Mme Sophie Bernard");
      expect(full).toContain("Management Agile");
      expect(full).toContain("Paris - La Défense");
      expect(full).toContain("9h00-17h30");

      const minimal = replaceCrmVariables(template, {
        prenom: "Jean",
        nom: "Dupont",
        formation: "Excel",
        date: "20 avril 2024",
      });

      expect(minimal).toContain(" Jean Dupont");
      expect(minimal).not.toContain("Lieu");
      expect(minimal).not.toContain("Horaires");
    });
  });
});
