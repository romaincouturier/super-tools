import { describe, expect, it } from "vitest";
import { sanitizeLmsEmbedHtml } from "./sanitizeLmsEmbedHtml";

const widget = '<style>#choice:checked + label { font-weight: bold; } details[open] { min-height: 200px; }</style><input type="radio" id="choice" name="quiz" value="yes"><label for="choice" class="answer">Oui</label><input type="checkbox"><input type="text" placeholder="Réponse"><details><summary>Détails</summary>Bravo</details>';

describe("isolated LMS HTML/CSS widgets", () => {
  it("keeps CSS, supported inputs, labels, details and identifiers", () => {
    const html = sanitizeLmsEmbedHtml(widget);
    expect(html).toContain("<style>");
    expect(html).toContain('#choice:checked + label');
    expect(html).toContain('type="radio"');
    expect(html).toContain('for="choice"');
    expect(html).toContain('name="quiz"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('placeholder="Réponse"');
    expect(html).toContain("<summary>Détails</summary>");
  });
  it("removes scripts, event handlers, forms/actions and executable elements", () => {
    const html = sanitizeLmsEmbedHtml('<script>alert(1)</script><style>label{color:red}</style><input type="file" onfocus="bad()"><div onclick="bad()">ok</div><a href="java&#x73;cript:bad()">bad</a><form action="https://example.com"><input type="text"></form><object data="x"></object><embed src="x">');
    expect(html).not.toMatch(/<script|onfocus|onclick|javascript:|<form|action=|<object|<embed|type="file"/i);
    expect(html).toContain('type="text"');
  });
  it("sanitizes nested srcdoc and enforces a script-disabled sandbox", () => {
    const html = sanitizeLmsEmbedHtml('<iframe sandbox="allow-scripts" srcdoc="&lt;style&gt;label{color:red}&lt;/style&gt;&lt;script&gt;bad()&lt;/script&gt;&lt;input type=&quot;checkbox&quot;&gt;"></iframe>');
    const doc = new DOMParser().parseFromString(html, "text/html");
    const frame = doc.querySelector("iframe");
    expect(frame?.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(frame?.getAttribute("srcdoc")).toContain("<style>");
    expect(frame?.getAttribute("srcdoc")).not.toContain("script");
  });
});
