import { describe, expect, it } from "vitest";
import { escapeHtml, safeUrl } from "./tenderHtml";

describe("escapeHtml", () => {
  it("neutralise le balisage d'un objet d'avis", () => {
    expect(escapeHtml('Marché <script>alert(1)</script> "urgent"')).toBe(
      "Marché &lt;script&gt;alert(1)&lt;/script&gt; &quot;urgent&quot;",
    );
  });

  it("échappe l'esperluette avant le reste", () => {
    expect(escapeHtml("R&D <b>")).toBe("R&amp;D &lt;b&gt;");
  });
});

describe("safeUrl", () => {
  it("accepte http et https", () => {
    expect(safeUrl("https://www.boamp.fr/avis?q=1")).toContain("https://www.boamp.fr/avis?q=1");
    expect(safeUrl("http://exemple.fr/")).toBe("http://exemple.fr/");
  });

  it("rejette les schémas dangereux", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejette ce qui n'est pas une URL, et l'absence d'URL", () => {
    expect(safeUrl("marches-securises.fr")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl("")).toBeNull();
  });

  it("échappe les guillemets pour ne pas sortir de l'attribut href", () => {
    const out = safeUrl('https://exemple.fr/a"onmouseover="alert(1)');
    expect(out).not.toBeNull();
    expect(out).not.toContain('"');
  });
});
