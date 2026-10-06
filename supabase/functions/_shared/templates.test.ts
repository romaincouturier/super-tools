/**
 * Tests for the edge function template processing module.
 *
 * Note: processTemplate uses escapeHtml from resend.ts which is Deno-native.
 * We test via replaceVariables (no escaping) and textToHtml/wrapEmailHtml
 * which we can import and test. For processTemplate with escapeValues=true,
 * we mock the module.
 */
import { describe, it, expect, vi } from "vitest";

// Mock the Deno-style import of resend.ts so vitest can resolve it
vi.mock("./resend.ts", () => ({
  escapeHtml: (str: string) => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
}));

// Now import AFTER the mock is set up
const { processTemplate, replaceVariables, textToHtml, templateTextToHtml, wrapEmailHtml } = await import("./templates");
const { renderEmailText } = await import("./editable-email");
const { EDITABLE_EMAIL_DEFAULTS } = await import("./editable-email-defaults");

// ═══════════════════════════════════════════════════════════════════════
// processTemplate (with HTML escaping by default)
// ═══════════════════════════════════════════════════════════════════════

describe("processTemplate", () => {
  // ── Simple variables ───────────────────────────────────────

  describe("simple variable substitution", () => {
    it("replaces a variable", () => {
      expect(processTemplate("Hello {{name}}", { name: "Alice" }))
        .toBe("Hello Alice");
    });

    it("escapes HTML in values by default", () => {
      expect(processTemplate("{{content}}", { content: "<script>alert('xss')</script>" }))
        .toBe("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    });

    it("escapes ampersands and quotes", () => {
      expect(processTemplate("{{val}}", { val: 'A & B "quoted"' }))
        .toBe('A &amp; B &quot;quoted&quot;');
    });

    it("replaces missing variable with empty string", () => {
      expect(processTemplate("Hello {{name}}", {})).toBe("Hello ");
    });

    it("replaces null variable with empty string", () => {
      expect(processTemplate("{{val}}", { val: null })).toBe("");
    });

    it("replaces undefined variable with empty string", () => {
      expect(processTemplate("{{val}}", { val: undefined })).toBe("");
    });

    it("handles multiple variables", () => {
      expect(processTemplate("{{a}} + {{b}} = {{c}}", { a: "1", b: "2", c: "3" }))
        .toBe("1 + 2 = 3");
    });
  });

  // ── Conditional blocks ─────────────────────────────────────

  describe("conditional blocks {{#var}}...{{/var}}", () => {
    it("includes block when variable has value", () => {
      expect(processTemplate("{{#name}}Bonjour {{name}}{{/name}}", { name: "Alice" }))
        .toBe("Bonjour Alice");
    });

    it("removes block when variable is missing", () => {
      expect(processTemplate("Debut{{#name}} Bonjour {{name}}{{/name}} Fin", {}))
        .toBe("Debut Fin");
    });

    it("removes block when variable is null", () => {
      expect(processTemplate("{{#x}}visible{{/x}}", { x: null }))
        .toBe("");
    });

    it("removes block when variable is undefined", () => {
      expect(processTemplate("{{#x}}visible{{/x}}", { x: undefined }))
        .toBe("");
    });

    it("removes block when variable is empty string", () => {
      expect(processTemplate("{{#x}}visible{{/x}}", { x: "" }))
        .toBe("");
    });

    it("handles multiple conditional blocks", () => {
      const template = "{{#a}}A={{a}}{{/a}} {{#b}}B={{b}}{{/b}}";
      expect(processTemplate(template, { a: "1" }))
        .toBe("A=1 ");
    });

    it("handles nested variable references inside conditional", () => {
      const template = "{{#show}}Name: {{name}}, Role: {{role}}{{/show}}";
      expect(processTemplate(template, { show: "yes", name: "Alice", role: "Admin" }))
        .toBe("Name: Alice, Role: Admin");
    });

    it("handles multiline content in conditional blocks", () => {
      const template = "{{#intro}}Line 1\nLine 2\nLine 3{{/intro}}";
      expect(processTemplate(template, { intro: "yes" }))
        .toBe("Line 1\nLine 2\nLine 3");
    });
  });

  // ── escapeValues option ────────────────────────────────────

  describe("escapeValues option", () => {
    it("does not escape when escapeValues is false", () => {
      expect(processTemplate("{{val}}", { val: "<b>bold</b>" }, false))
        .toBe("<b>bold</b>");
    });

    it("escapes when escapeValues is true (default)", () => {
      expect(processTemplate("{{val}}", { val: "<b>bold</b>" }))
        .toBe("&lt;b&gt;bold&lt;/b&gt;");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// replaceVariables (alias for processTemplate without escaping)
// ═══════════════════════════════════════════════════════════════════════

describe("replaceVariables", () => {
  it("does not escape HTML", () => {
    expect(replaceVariables("{{val}}", { val: "<b>bold</b>" }))
      .toBe("<b>bold</b>");
  });

  it("handles conditionals", () => {
    expect(replaceVariables("{{#show}}yes{{/show}}", { show: "1" }))
      .toBe("yes");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// textToHtml
// ═══════════════════════════════════════════════════════════════════════

describe("textToHtml", () => {
  it("wraps single paragraph in <p>", () => {
    expect(textToHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("splits double newlines into separate paragraphs", () => {
    expect(textToHtml("Paragraph 1\n\nParagraph 2"))
      .toBe("<p>Paragraph 1</p><p>Paragraph 2</p>");
  });

  it("converts single newlines to <br>", () => {
    expect(textToHtml("Line 1\nLine 2"))
      .toBe("<p>Line 1<br>Line 2</p>");
  });

  it("handles mixed single and double newlines", () => {
    expect(textToHtml("A\nB\n\nC\nD"))
      .toBe("<p>A<br>B</p><p>C<br>D</p>");
  });

  it("returns empty string for empty input", () => {
    expect(textToHtml("")).toBe("");
  });

  it("escapes HTML in text", () => {
    expect(textToHtml("<script>alert('x')</script>"))
      .toBe("<p>&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;</p>");
  });

  it("handles multiple consecutive blank lines", () => {
    const result = textToHtml("A\n\n\n\nB");
    expect(result).toBe("<p>A</p><p>B</p>");
  });

  it("trims whitespace from lines", () => {
    expect(textToHtml("  hello  \n  world  "))
      .toBe("<p>hello<br>world</p>");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// templateTextToHtml
// ═══════════════════════════════════════════════════════════════════════

describe("templateTextToHtml", () => {
  it("renders bold in paragraphs and bullet lists", () => {
    const result = templateTextToHtml("Formation **Facilitation graphique**\n\n• **Lieu :** Paris\n- **Date :** demain");
    expect(result).toContain("<p>Formation <strong>Facilitation graphique</strong></p>");
    expect(result).toContain("<li><strong>Lieu :</strong> Paris</li>");
    expect(result).toContain("<li><strong>Date :</strong> demain</li>");
    expect(result).not.toContain("**");
  });

  it("leaves unmatched asterisks unchanged", () => {
    expect(templateTextToHtml("Texte **inachevé * simple")).toBe("<p>Texte **inachevé * simple</p>");
  });

  it("renders editable email bold while preserving escaped values and protected blocks", () => {
    const block = '<p><a href="https://example.com/?a=1&b=2">Signer **ici**</a></p>';
    const result = renderEmailText("Formation {{training_name}}", "Formation **{{training_name}}**\n\n📍 **Lieu :** {{location}}\n\n{{cta}}", {
      training_name: 'A & B <img src=x onerror="alert(1)">',
      location: "Paris",
    }, { cta: block });
    expect(result.html).toContain('<strong>A &amp; B &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</strong>');
    expect(result.html).toContain("📍 <strong>Lieu :</strong> Paris");
    expect(result.html).toContain(block);
    expect(result.html).not.toContain("<img");
    expect(result.html).not.toContain("&amp;amp;");
    expect(result.subject).toBe('Formation A & B <img src=x onerror="alert(1)">');
  });

  it("renders bold markers in every catalog default in both language variants", () => {
    for (const entry of Object.values(EDITABLE_EMAIL_DEFAULTS)) {
      for (const mode of ["tu", "vous"] as const) {
        const content = entry.content[mode];
        const vars = Object.fromEntries([...content.matchAll(/\{\{[#/]?(\w+)\}\}/g)].map((match) => [match[1], "Valeur"]));
        const result = renderEmailText(entry.subject[mode], content, vars);
        expect(result.html, `${entry.subject[mode]} (${mode})`).not.toContain("**");
        if (content.includes("**")) expect(result.html).toContain("<strong>");
      }
    }
  });

  it("groups bullet lines into a single list even with blank lines", () => {
    const input = "Bonjour\n\n• Point 1\n\n• Point 2\n\nMerci";
    const result = templateTextToHtml(input);

    expect(result).toContain("<ul");
    expect(result).toContain("<li>Point 1</li>");
    expect(result).toContain("<li>Point 2</li>");
    expect((result.match(/<ul/g) || []).length).toBe(1);
  });

  it("does not create empty paragraphs around bullet sections", () => {
    const input = "Intro\n\n• A\n\n• B\n\nOutro";
    const result = templateTextToHtml(input);

    expect(result).not.toContain("<p></p>");
    expect(result).toContain("<p>Intro</p>");
    expect(result).toContain("<p>Outro</p>");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// wrapEmailHtml
// ═══════════════════════════════════════════════════════════════════════

describe("wrapEmailHtml", () => {
  it("wraps body and signature in HTML document", () => {
    const result = wrapEmailHtml("<p>Hello</p>", "<p>Signature</p>");
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain('<html lang="fr">');
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>Signature</p>");
    expect(result).toContain("</body>");
    expect(result).toContain("</html>");
  });

  it("includes viewport meta tag", () => {
    const result = wrapEmailHtml("", "");
    expect(result).toContain("viewport");
    expect(result).toContain("width=device-width");
  });

  it("includes charset", () => {
    const result = wrapEmailHtml("", "");
    expect(result).toContain('charset="UTF-8"');
  });

  it("applies font-family styling to body", () => {
    const result = wrapEmailHtml("", "");
    expect(result).toContain("font-family: Arial, sans-serif");
  });
});
