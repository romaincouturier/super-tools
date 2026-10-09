import { describe, expect, it, vi } from "vitest";
vi.mock("https://esm.sh/sanitize-html@2.17.0", async () => ({ default: (await import("sanitize-html")).default }));
import { sanitizeEmbedHtml, sanitizeUpdatePatch, sanitizeRestructureBlocks } from "./lms-block-catalog";

const widget = '<style>input:checked+label{font-weight:bold}</style><input type="radio" id="q" name="answer"><label for="q">Oui</label><details><summary>Réponse</summary>Bravo</details>';
describe("MCP script-free HTML/CSS writes", () => {
  it("preserves widgets in update and restructure for both block types", () => {
    for (const [type, key] of [["html_embed", "html"], ["exercise", "interactive_html"]]) {
      const patch = sanitizeUpdatePatch(type, { [key]: widget });
      expect(patch[key]).toContain("<style>");
      expect(patch[key]).toContain('for="q"');
      const blocks = sanitizeRestructureBlocks([{ type, content: { [key]: widget, ...(type === "exercise" ? { prompt_html: "Question" } : {}) } }]);
      expect(blocks[0].content[key]).toContain('type="radio"');
      expect(blocks[0].content[key]).toContain("<summary>");
    }
  });
  it("blocks dangerous markup and encoded URL schemes", () => {
    const html = sanitizeEmbedHtml('<script>bad()</script><input type="submit"><input type="file"><input type="checkbox" onclick="bad()"><form action="https://example.com">form</form><object>obj</object><embed><a href="java&#x73;cript:bad()">link</a>');
    expect(html).not.toMatch(/<script|bad\(\)|type="submit"|type="file"|onclick|<form|action=|<object|<embed|javascript:/i);
    expect(html).toContain('type="checkbox"');
  });
  it("keeps nested srcdoc CSS but strips scripts and overrides sandbox", () => {
    const html = sanitizeEmbedHtml('<iframe sandbox="allow-scripts" srcdoc="&lt;style&gt;p{color:red}&lt;/style&gt;&lt;script&gt;bad()&lt;/script&gt;&lt;p&gt;OK&lt;/p&gt;"></iframe>');
    const frame = new DOMParser().parseFromString(html, "text/html").querySelector("iframe");
    expect(frame?.getAttribute("srcdoc")).toContain("<style>");
    expect(frame?.getAttribute("srcdoc")).not.toContain("script");
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin");
  });
});
