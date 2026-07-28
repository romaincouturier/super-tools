import { describe, it, expect } from "vitest";
import { splitHtmlIntoBlocks } from "./missionPageBlocks";

describe("splitHtmlIntoBlocks", () => {
  it("retourne un bloc par élément de premier niveau", () => {
    const blocks = splitHtmlIntoBlocks("<h1>Titre</h1><p>Texte</p><ul><li>a</li></ul>");
    expect(blocks.map((b) => b.text)).toEqual(["Titre", "Texte", "a"]);
  });

  it("donne un id stable quand le bloc est déplacé", () => {
    const before = splitHtmlIntoBlocks("<p>Alpha</p><p>Beta</p>");
    const after = splitHtmlIntoBlocks("<p>Beta</p><p>Alpha</p>");
    expect(after[1].id).toBe(before[0].id);
    expect(after[0].id).toBe(before[1].id);
  });

  it("change l'id quand le texte du bloc est réécrit", () => {
    const before = splitHtmlIntoBlocks("<p>Alpha</p>");
    const after = splitHtmlIntoBlocks("<p>Alpha corrigé</p>");
    expect(after[0].id).not.toBe(before[0].id);
  });

  it("ignore la casse et les espaces superflus", () => {
    const a = splitHtmlIntoBlocks("<p>Bonjour   le monde</p>");
    const b = splitHtmlIntoBlocks("<p>bonjour le monde</p>");
    expect(a[0].id).toBe(b[0].id);
  });

  it("distingue deux blocs de texte identique", () => {
    const blocks = splitHtmlIntoBlocks("<p>Oui</p><p>Oui</p>");
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });

  it("identifie les blocs sans texte par leur balise", () => {
    const blocks = splitHtmlIntoBlocks('<img src="a.png"><img src="b.png">');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).not.toBe(blocks[1].id);
  });

  it("retourne un tableau vide pour un contenu vide", () => {
    expect(splitHtmlIntoBlocks("")).toEqual([]);
    expect(splitHtmlIntoBlocks("   ")).toEqual([]);
  });
});
