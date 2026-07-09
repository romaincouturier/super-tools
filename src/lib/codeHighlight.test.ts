import { describe, it, expect } from "vitest";
import { tokenizeCode, tokenizeCodeLines, codeLanguageLabel, CODE_LANGUAGES } from "./codeHighlight";

const join = (tokens: { value: string }[]) => tokens.map((t) => t.value).join("");

describe("tokenizeCode — javascript", () => {
  it("marque les mots-clés", () => {
    const tokens = tokenizeCode("const x = value;", "javascript");
    expect(tokens).toContainEqual({ type: "keyword", value: "const" });
    expect(tokens.find((t) => t.value.includes("value"))?.type).toBe("plain");
  });

  it("marque les chaînes (doubles, simples, template)", () => {
    const tokens = tokenizeCode("a = \"hi\" + 'yo' + `tpl`", "javascript");
    expect(tokens).toContainEqual({ type: "string", value: '"hi"' });
    expect(tokens).toContainEqual({ type: "string", value: "'yo'" });
    expect(tokens).toContainEqual({ type: "string", value: "`tpl`" });
  });

  it("marque les commentaires ligne et bloc", () => {
    const tokens = tokenizeCode("// note\n/* bloc */", "javascript");
    expect(tokens).toContainEqual({ type: "comment", value: "// note" });
    expect(tokens).toContainEqual({ type: "comment", value: "/* bloc */" });
  });

  it("marque les nombres (entiers, décimaux, hexa)", () => {
    const tokens = tokenizeCode("a = 42 + 3.14 + 0xFF", "javascript");
    expect(tokens).toContainEqual({ type: "number", value: "42" });
    expect(tokens).toContainEqual({ type: "number", value: "3.14" });
    expect(tokens).toContainEqual({ type: "number", value: "0xFF" });
  });

  it("ne colore pas un mot-clé contenu dans un identifiant", () => {
    const tokens = tokenizeCode("iffy = newish", "javascript");
    expect(tokens.every((t) => t.type === "plain")).toBe(true);
  });

  it("ne colore pas un mot-clé à l'intérieur d'une chaîne", () => {
    const tokens = tokenizeCode('"const inside"', "javascript");
    expect(tokens).toEqual([{ type: "string", value: '"const inside"' }]);
  });

  it("le chiffre en fin d'identifiant n'est pas un nombre", () => {
    const tokens = tokenizeCode("foo1", "javascript");
    expect(tokens).toEqual([{ type: "plain", value: "foo1" }]);
  });
});

describe("tokenizeCode — typescript", () => {
  it("connaît les mots-clés TS supplémentaires", () => {
    const tokens = tokenizeCode("interface Props { name: string }", "typescript");
    expect(tokens).toContainEqual({ type: "keyword", value: "interface" });
    expect(tokens).toContainEqual({ type: "keyword", value: "string" });
  });
});

describe("tokenizeCode — python", () => {
  it("commentaires # et chaînes triple-quotes", () => {
    const tokens = tokenizeCode('# note\n"""doc\nstring"""\ndef f():', "python");
    expect(tokens).toContainEqual({ type: "comment", value: "# note" });
    expect(tokens).toContainEqual({ type: "string", value: '"""doc\nstring"""' });
    expect(tokens).toContainEqual({ type: "keyword", value: "def" });
  });
});

describe("tokenizeCode — sql", () => {
  it("mots-clés insensibles à la casse et commentaires --", () => {
    const tokens = tokenizeCode("SELECT id FROM users -- tout", "sql");
    expect(tokens).toContainEqual({ type: "keyword", value: "SELECT" });
    expect(tokens).toContainEqual({ type: "keyword", value: "FROM" });
    expect(tokens).toContainEqual({ type: "comment", value: "-- tout" });
  });

  it("chaînes simples avec quote doublée", () => {
    const tokens = tokenizeCode("WHERE name = 'l''eau'", "sql");
    expect(tokens).toContainEqual({ type: "string", value: "'l''eau'" });
  });
});

describe("tokenizeCode — html", () => {
  it("balises en keyword, attributs en string, commentaires", () => {
    const tokens = tokenizeCode('<div class="box"><!-- c --></div>', "html");
    expect(tokens).toContainEqual({ type: "keyword", value: "<div" });
    expect(tokens).toContainEqual({ type: "string", value: '"box"' });
    expect(tokens).toContainEqual({ type: "comment", value: "<!-- c -->" });
    expect(tokens).toContainEqual({ type: "keyword", value: "</div" });
  });
});

describe("tokenizeCode — css", () => {
  it("propriétés, at-rules, couleurs hexa et unités", () => {
    const tokens = tokenizeCode("@media screen { .a { color: #fff; margin: 4px; } }", "css");
    expect(tokens).toContainEqual({ type: "keyword", value: "@media" });
    expect(tokens).toContainEqual({ type: "keyword", value: "color" });
    expect(tokens).toContainEqual({ type: "number", value: "#fff" });
    expect(tokens).toContainEqual({ type: "number", value: "4px" });
  });
});

describe("tokenizeCode — bash", () => {
  it("mots-clés, chaînes et commentaires", () => {
    const tokens = tokenizeCode('if true; then echo "ok"; fi # done', "bash");
    expect(tokens).toContainEqual({ type: "keyword", value: "if" });
    expect(tokens).toContainEqual({ type: "keyword", value: "echo" });
    expect(tokens).toContainEqual({ type: "string", value: '"ok"' });
    expect(tokens).toContainEqual({ type: "comment", value: "# done" });
  });
});

describe("tokenizeCode — json", () => {
  it("chaînes, nombres négatifs et littéraux", () => {
    const tokens = tokenizeCode('{"a": -1.5, "b": null}', "json");
    expect(tokens).toContainEqual({ type: "string", value: '"a"' });
    expect(tokens).toContainEqual({ type: "number", value: "-1.5" });
    expect(tokens).toContainEqual({ type: "keyword", value: "null" });
  });
});

describe("tokenizeCode — fallback", () => {
  it("langage inconnu : un seul token plain", () => {
    expect(tokenizeCode("some text", "ruby")).toEqual([{ type: "plain", value: "some text" }]);
    expect(tokenizeCode("some text", "plain")).toEqual([{ type: "plain", value: "some text" }]);
  });

  it("code vide : aucun token", () => {
    expect(tokenizeCode("", "javascript")).toEqual([]);
    expect(tokenizeCode("", "ruby")).toEqual([]);
  });
});

describe("tokenizeCode — round-trip", () => {
  it("la concaténation des tokens restitue exactement le code source", () => {
    const samples: Array<[string, string]> = [
      ["const a = `x${1}`;\n// fin", "javascript"],
      ["def f():\n    return 'ok'  # fin", "python"],
      ["SELECT * FROM t WHERE a = 'x''y'", "sql"],
      ['<p title="a>b">texte</p>', "html"],
      [".a { color: #ff0000; }", "css"],
      ['echo "hello" # c', "bash"],
      ['{"k": [1, true]}', "json"],
    ];
    for (const [code, lang] of samples) {
      expect(join(tokenizeCode(code, lang))).toBe(code);
    }
  });

  it("chaîne non terminée : pas de boucle infinie, round-trip conservé", () => {
    const code = 'const a = "oops\nnext';
    expect(join(tokenizeCode(code, "javascript"))).toBe(code);
  });
});

describe("tokenizeCodeLines", () => {
  it("découpe le flux de tokens par ligne", () => {
    const lines = tokenizeCodeLines("const a = 1;\nreturn a;", "javascript");
    expect(lines).toHaveLength(2);
    expect(lines[0][0]).toEqual({ type: "keyword", value: "const" });
    expect(lines[1][0]).toEqual({ type: "keyword", value: "return" });
  });

  it("scinde un commentaire de bloc multi-lignes en gardant le type", () => {
    const lines = tokenizeCodeLines("/* a\nb */", "javascript");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual([{ type: "comment", value: "/* a" }]);
    expect(lines[1]).toEqual([{ type: "comment", value: "b */" }]);
  });

  it("les lignes vides produisent des tableaux vides", () => {
    const lines = tokenizeCodeLines("a\n\nb", "javascript");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
  });
});

describe("codeLanguageLabel", () => {
  it("retourne le label des langages connus, la valeur brute sinon", () => {
    expect(codeLanguageLabel("javascript")).toBe("JavaScript");
    expect(codeLanguageLabel("ruby")).toBe("ruby");
  });

  it("chaque langage a un value et un label non vides", () => {
    for (const l of CODE_LANGUAGES) {
      expect(l.value).toBeTruthy();
      expect(l.label).toBeTruthy();
    }
  });
});
