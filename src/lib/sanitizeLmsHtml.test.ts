import { describe, expect, it } from "vitest";
import { containsHtmlTag, sanitizeLmsHtml } from "./sanitizeLmsHtml";

describe("sanitizeLmsHtml", () => {
  it("supprime un script injecté en gardant le contenu légitime", () => {
    const out = sanitizeLmsHtml('<p>Consigne</p><script>alert("xss")</script>');
    expect(out).toContain("<p>Consigne</p>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
  });

  it("supprime les handlers d'événements sur les balises classiques", () => {
    const out = sanitizeLmsHtml('<p onclick="alert(1)">Texte</p><img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>Texte</p>");
  });

  it("conserve une iframe légitime https avec ses attributs allowlistés", () => {
    const out = sanitizeLmsHtml(
      '<iframe src="https://www.youtube.com/embed/abc123" width="560" height="315" allow="autoplay; fullscreen" allowfullscreen frameborder="0" title="Vidéo consigne"></iframe>',
    );
    expect(out).toContain("<iframe");
    expect(out).toContain('src="https://www.youtube.com/embed/abc123"');
    expect(out).toContain('width="560"');
    expect(out).toContain('height="315"');
    expect(out).toContain('allow="autoplay; fullscreen"');
    expect(out).toContain("allowfullscreen");
    expect(out).toContain('frameborder="0"');
    expect(out).toContain('title="Vidéo consigne"');
  });

  it("retire les attributs hors allowlist sur une iframe", () => {
    const out = sanitizeLmsHtml(
      '<iframe src="https://example.com/embed" onload="alert(1)" srcdoc="<script>alert(1)</script>" name="x" style="position:fixed"></iframe>',
    );
    expect(out).toContain('src="https://example.com/embed"');
    expect(out).not.toContain("onload");
    expect(out).not.toContain("srcdoc");
    expect(out).not.toContain("name=");
    expect(out).not.toContain("style=");
  });

  it("supprime entièrement une iframe avec src javascript:", () => {
    const out = sanitizeLmsHtml('<p>Avant</p><iframe src="javascript:alert(1)"></iframe><p>Après</p>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("<p>Avant</p>");
    expect(out).toContain("<p>Après</p>");
  });

  it("supprime les iframes sans src, data: ou protocol-relative", () => {
    expect(sanitizeLmsHtml("<iframe></iframe>")).not.toContain("<iframe");
    expect(sanitizeLmsHtml('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')).not.toContain("<iframe");
    expect(sanitizeLmsHtml('<iframe src="//evil.example.com/x"></iframe>')).not.toContain("<iframe");
  });

  it("conserve un schéma SVG inline avec ses enfants et ses attributs", () => {
    const out = sanitizeLmsHtml(
      '<p>Schéma</p><svg viewBox="0 0 100 50" width="100" height="50" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><marker id="fleche" markerWidth="6" markerHeight="6" refX="3" orient="auto">' +
        '<path d="M0,0 L6,3 L0,6 z" fill="#101820"/></marker></defs>' +
        '<g transform="translate(2,2)">' +
        '<rect x="1" y="2" width="10" height="8" rx="2" fill="#ffd100" stroke="#101820" stroke-width="1.5"/>' +
        '<circle cx="20" cy="10" r="5" fill="none"/>' +
        '<ellipse cx="30" cy="10" rx="6" ry="4"/>' +
        '<polygon points="0,0 10,0 5,9"/><polyline points="0,0 5,5"/>' +
        '<line x1="0" y1="0" x2="10" y2="10" marker-end="url(#fleche)"/>' +
        '<text x="5" y="20" font-size="10" text-anchor="middle">Étape<tspan dy="4">1</tspan></text>' +
        "</g></svg>",
    );
    for (const tag of [
      "<svg",
      "<defs",
      "<marker",
      "<path",
      "<g",
      "<rect",
      "<circle",
      "<ellipse",
      "<polygon",
      "<polyline",
      "<line",
      "<text",
      "<tspan",
    ]) {
      expect(out).toContain(tag);
    }
    expect(out).toContain('viewBox="0 0 100 50"');
    expect(out).toContain('d="M0,0 L6,3 L0,6 z"');
    expect(out).toContain('fill="#ffd100"');
    expect(out).toContain('stroke-width="1.5"');
    expect(out).toContain('transform="translate(2,2)"');
    expect(out).toContain('text-anchor="middle"');
    expect(out).toContain('marker-end="url(#fleche)"');
    expect(out).toContain("Étape");
  });

  it("neutralise un SVG piégé sans jeter le schéma", () => {
    const out = sanitizeLmsHtml(
      '<svg viewBox="0 0 10 10" onload="alert(1)">' +
        "<script>alert(2)</script>" +
        '<rect width="10" height="10" onclick="alert(3)"/>' +
        '<foreignObject><body><img src="x" onerror="alert(4)"></body></foreignObject>' +
        '<a href="javascript:alert(5)"><circle r="2"/></a>' +
        "</svg>",
    );
    expect(out).toContain("<svg");
    expect(out).toContain("<rect");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("foreignObject");
  });

  it("rend le texte brut échappé avec sauts de ligne préservés", () => {
    const out = sanitizeLmsHtml("Étape 1 : lire\nÉtape 2 : 2 < 3 && \"tester\"");
    expect(out).toBe("Étape 1 : lire<br>Étape 2 : 2 &lt; 3 &amp;&amp; &quot;tester&quot;");
  });

  it("détecte la présence de balises HTML", () => {
    expect(containsHtmlTag("<p>x</p>")).toBe(true);
    expect(containsHtmlTag('<iframe src="https://x"></iframe>')).toBe(true);
    expect(containsHtmlTag("texte simple\navec retour")).toBe(false);
    expect(containsHtmlTag("2 < 3 et 5 > 4")).toBe(false);
  });
});
