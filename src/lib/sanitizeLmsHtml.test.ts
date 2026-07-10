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
