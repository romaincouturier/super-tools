import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock with chainable query builder ──────────────────────────────
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn(() => ({ data: [], error: null }));
const mockLike = vi.fn(() => ({ order: mockOrder }));
const mockSelectAll = vi.fn(() => ({ like: mockLike }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ select: mockSelect })) }));
const mockDeleteEq = vi.fn(() => ({ data: null, error: null }));
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq }));
const mockFrom = vi.fn(() => ({
  select: mockSelectAll,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// ── React Query mock that captures hook configs ─────────────────────────────
let capturedQueryConfig: Record<string, unknown> | null = null;
let capturedMutationConfig: Record<string, unknown> | null = null;
const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: Record<string, unknown>) => {
    capturedQueryConfig = config;
    return { data: undefined, isLoading: false };
  },
  useMutation: (config: Record<string, unknown>) => {
    capturedMutationConfig = config;
    return { mutate: vi.fn(), mutateAsync: vi.fn() };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

const {
  replaceCrmVariables,
  generateTemplateSlug,
  useCrmEmailTemplates,
  useCreateCrmTemplate,
  useUpdateCrmTemplate,
  useDeleteCrmTemplate,
} = await import("./useCrmEmailTemplates");

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

    it("conditional block with fallback inner variable works correctly", () => {
      // The conditional is processed FIRST — inner {{var}} resolved within it
      // Then fallback syntax is resolved on the remaining template
      // This proves order matters: if fallback ran first, {{name||X}} inside
      // a conditional block would be consumed before the conditional is evaluated.
      const template = "{{show?Nom: {{name}}}} — {{title||M.}}";
      expect(
        replaceCrmVariables(template, { show: "1", name: "Alice", title: "Dr." }),
      ).toBe("Nom: Alice — Dr.");
      // show absent → conditional stripped, then fallback applies
      expect(
        replaceCrmVariables(template, {}),
      ).toBe(" — M.");
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

    it("ignores variables with hyphens (not matched by \\w+)", () => {
      expect(
        replaceCrmVariables("{{nom-variable}}", { "nom-variable": "valeur" }),
      ).toBe("{{nom-variable}}");
    });

    it("ignores variables with dots (not matched by \\w+)", () => {
      expect(
        replaceCrmVariables("{{obj.prop}}", { "obj.prop": "valeur" }),
      ).toBe("{{obj.prop}}");
    });

    it("handles adversarial long variable name in template without ReDoS", () => {
      const longVar = "a".repeat(1000);
      const template = `{{${longVar}}}`;
      const start = Date.now();
      const result = replaceCrmVariables(template, {});
      const elapsed = Date.now() - start;
      expect(result).toBe("");
      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });

    it("handles adversarial nested-looking braces without ReDoS", () => {
      // Stress test: many {{ patterns that don't form valid placeholders
      const template = "{{".repeat(500) + "}}".repeat(500);
      const start = Date.now();
      replaceCrmVariables(template, {});
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    it("handles adversarial long conditional content without ReDoS", () => {
      const longContent = "x".repeat(5000);
      const template = `{{flag?${longContent}}}`;
      const start = Date.now();
      const result = replaceCrmVariables(template, { flag: "1" });
      const elapsed = Date.now() - start;
      expect(result).toBe(longContent);
      expect(elapsed).toBeLessThan(100);
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

      expect(result).toBe(
        "Bonjour M. Martin,\n" +
        "\n" +
        "Je me permets de vous contacter concernant TechCorp.\n" +
        "\n" +
        "Suite à notre échange, je souhaitais vous présenter notre offre formation React.\n" +
        "\n" +
        "Le montant estimé est de 3 500€ HT.\n" +
        "\n" +
        "Cordialement,\n" +
        "Romain Couturier",
      );
    });

    it("renders same template with minimal data", () => {
      const template = [
        "Bonjour {{titre||Madame, Monsieur}},",
        "{{entreprise?Concernant {{entreprise}}, }}voici notre proposition {{offre||de service}}.",
        "{{montant?Budget: {{montant}}.}}",
        "Cordialement, {{signature||L'équipe}}",
      ].join("\n");

      const result = replaceCrmVariables(template, {});

      expect(result).toBe(
        "Bonjour Madame, Monsieur,\n" +
        "voici notre proposition de service.\n" +
        "\n" +
        "Cordialement, L'équipe",
      );
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

      expect(full).toBe(
        "Mme Sophie Bernard,\n" +
        "Votre formation «Management Agile» débutera le 15 mars 2024.\n" +
        "Lieu : Paris - La Défense\n" +
        "Horaires : 9h00-17h30\n",
      );

      const minimal = replaceCrmVariables(template, {
        prenom: "Jean",
        nom: "Dupont",
        formation: "Excel",
        date: "20 avril 2024",
      });

      expect(minimal).toBe(
        " Jean Dupont,\n" +
        "Votre formation «Excel» débutera le 20 avril 2024.\n",
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateTemplateSlug
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateTemplateSlug", () => {
  describe("cas nominaux", () => {
    it("converts simple name to lowercase slug", () => {
      expect(generateTemplateSlug("Relance Client")).toBe("relance_client");
    });

    it("removes accents (NFD normalization)", () => {
      expect(generateTemplateSlug("Relance échéance")).toBe("relance_echeance");
    });

    it("handles multiple special characters", () => {
      expect(generateTemplateSlug("Offre & Devis (v2)")).toBe("offre_devis_v2");
    });

    it("collapses consecutive non-alnum chars into single underscore", () => {
      expect(generateTemplateSlug("a---b___c   d")).toBe("a_b_c_d");
    });
  });

  describe("cas aux limites", () => {
    it("strips leading and trailing underscores", () => {
      expect(generateTemplateSlug("  Hello  ")).toBe("hello");
      expect(generateTemplateSlug("___test___")).toBe("test");
    });

    it("handles purely numeric name", () => {
      expect(generateTemplateSlug("123")).toBe("123");
    });

    it("handles name with only special characters", () => {
      expect(generateTemplateSlug("---")).toBe("");
    });

    it("handles empty string", () => {
      expect(generateTemplateSlug("")).toBe("");
    });

    it("handles complex French accented name", () => {
      expect(generateTemplateSlug("Réunion préparatoire à l'été")).toBe(
        "reunion_preparatoire_a_l_ete",
      );
    });

    it("handles unicode beyond Latin accents (e.g. cedilla)", () => {
      expect(generateTemplateSlug("Reçu façade")).toBe("recu_facade");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hook integration tests — query/mutation contracts
// ═══════════════════════════════════════════════════════════════════════════════

describe("useCrmEmailTemplates (hook)", () => {
  beforeEach(() => {
    capturedQueryConfig = null;
    vi.clearAllMocks();
  });

  it("uses the correct query key", () => {
    useCrmEmailTemplates();
    expect(capturedQueryConfig).not.toBeNull();
    expect(capturedQueryConfig!.queryKey).toEqual(["crm-email-templates"]);
  });

  it("queryFn calls supabase with correct table and filter", async () => {
    const mockData = [{ id: "t1", template_name: "Test" }];
    mockOrder.mockReturnValueOnce({ data: mockData, error: null });

    useCrmEmailTemplates();
    const queryFn = capturedQueryConfig!.queryFn as () => Promise<unknown>;
    const result = await queryFn();

    expect(mockFrom).toHaveBeenCalledWith("email_templates");
    expect(mockLike).toHaveBeenCalledWith("template_type", "crm_%");
    expect(mockOrder).toHaveBeenCalledWith("template_name");
    expect(result).toEqual(mockData);
  });

  it("queryFn throws on Supabase error", async () => {
    mockOrder.mockReturnValueOnce({ data: null, error: new Error("DB error") });

    useCrmEmailTemplates();
    const queryFn = capturedQueryConfig!.queryFn as () => Promise<unknown>;
    await expect(queryFn()).rejects.toThrow("DB error");
  });
});

describe("useCreateCrmTemplate (hook)", () => {
  beforeEach(() => {
    capturedMutationConfig = null;
    vi.clearAllMocks();
  });

  it("mutationFn inserts with correct template_type using generateTemplateSlug", async () => {
    const insertedData = { id: "new-1", template_type: "crm_relance_ete" };
    mockSingle.mockResolvedValueOnce({ data: insertedData, error: null });

    useCreateCrmTemplate();
    const mutationFn = capturedMutationConfig!.mutationFn as (input: unknown) => Promise<unknown>;
    const result = await mutationFn({
      template_name: "Relance été",
      subject: "Bonjour",
      html_content: "<p>Test</p>",
    });

    expect(mockFrom).toHaveBeenCalledWith("email_templates");
    expect(mockInsert).toHaveBeenCalledWith({
      template_type: "crm_relance_ete",
      template_name: "Relance été",
      subject: "Bonjour",
      html_content: "<p>Test</p>",
      is_default: false,
    });
    expect(result).toEqual(insertedData);
  });

  it("mutationFn throws on Supabase error", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error("Insert failed") });

    useCreateCrmTemplate();
    const mutationFn = capturedMutationConfig!.mutationFn as (input: unknown) => Promise<unknown>;
    await expect(
      mutationFn({ template_name: "Test", subject: "s", html_content: "c" }),
    ).rejects.toThrow("Insert failed");
  });

  it("onSuccess invalidates the correct query key", () => {
    useCreateCrmTemplate();
    const onSuccess = capturedMutationConfig!.onSuccess as () => void;
    onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["crm-email-templates"],
    });
  });
});

describe("useUpdateCrmTemplate (hook)", () => {
  beforeEach(() => {
    capturedMutationConfig = null;
    vi.clearAllMocks();
  });

  it("mutationFn calls update with correct id and fields", async () => {
    const mockEq = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "t1" }, error: null }) })) }));
    mockFrom.mockReturnValueOnce({
      update: vi.fn((updates) => {
        expect(updates).toEqual({ subject: "New Subject" });
        return { eq: mockEq };
      }),
    } as any);

    useUpdateCrmTemplate();
    const mutationFn = capturedMutationConfig!.mutationFn as (input: unknown) => Promise<unknown>;
    await mutationFn({ id: "t1", updates: { subject: "New Subject" } });

    expect(mockEq).toHaveBeenCalledWith("id", "t1");
  });

  it("onSuccess invalidates the correct query key", () => {
    useUpdateCrmTemplate();
    const onSuccess = capturedMutationConfig!.onSuccess as () => void;
    onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["crm-email-templates"],
    });
  });
});

describe("useDeleteCrmTemplate (hook)", () => {
  beforeEach(() => {
    capturedMutationConfig = null;
    vi.clearAllMocks();
  });

  it("mutationFn calls delete with correct id", async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: null });

    useDeleteCrmTemplate();
    const mutationFn = capturedMutationConfig!.mutationFn as (id: string) => Promise<void>;
    await mutationFn("template-42");

    expect(mockFrom).toHaveBeenCalledWith("email_templates");
    expect(mockDeleteEq).toHaveBeenCalledWith("id", "template-42");
  });

  it("mutationFn throws on Supabase error", async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: new Error("Delete failed") });

    useDeleteCrmTemplate();
    const mutationFn = capturedMutationConfig!.mutationFn as (id: string) => Promise<void>;
    await expect(mutationFn("bad-id")).rejects.toThrow("Delete failed");
  });

  it("onSuccess invalidates the correct query key", () => {
    useDeleteCrmTemplate();
    const onSuccess = capturedMutationConfig!.onSuccess as () => void;
    onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["crm-email-templates"],
    });
  });
});
