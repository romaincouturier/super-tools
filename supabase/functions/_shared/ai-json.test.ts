import { describe, it, expect } from "vitest";
import { parseAiJson, truncateForLog } from "./ai-json.ts";

/**
 * Ce fichier était écrit pour `deno test`, qui n'est lancé nulle part : vitest
 * le ramassait par son glob `_shared/**\/*.test.ts` et échouait à l'import
 * (`https://deno.land/...` n'est pas résoluble par Node). Les assertions sont
 * les mêmes, portées sur le seul harnais que la CI exécute.
 */

describe("parseAiJson", () => {
  it("lit un JSON nu", () => {
    expect(parseAiJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("lit un JSON encadré par une clôture markdown", () => {
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("lit un JSON entouré de prose", () => {
    expect(parseAiJson('Voici le résultat :\n{"a":[1,2]}\nBonne journée !')).toEqual({ a: [1, 2] });
  });

  it("ignore les accolades à l'intérieur des chaînes", () => {
    expect(parseAiJson('blah {"a":"} not the end","b":2} tail')).toEqual({
      a: "} not the end",
      b: 2,
    });
  });

  it("tolère les virgules finales", () => {
    expect(parseAiJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it("lit un tableau", () => {
    expect(parseAiJson("texte [1,2,3]")).toEqual([1, 2, 3]);
  });

  it("rend null quand il n'y a pas de JSON", () => {
    expect(parseAiJson("désolé je ne peux pas")).toBeNull();
    expect(parseAiJson("")).toBeNull();
  });
});

describe("truncateForLog", () => {
  it("tronque et annonce la longueur réelle", () => {
    const out = truncateForLog("x".repeat(50), 10);

    expect(out.startsWith("x".repeat(10))).toBe(true);
    expect(out).toContain("50 chars total");
  });
});
