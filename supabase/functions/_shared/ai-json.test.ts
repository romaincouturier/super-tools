import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { parseAiJson, truncateForLog } from "./ai-json.ts";

Deno.test("parses plain JSON", () => {
  assertEquals(parseAiJson('{"a":1}'), { a: 1 });
});

Deno.test("parses fenced JSON", () => {
  assertEquals(parseAiJson('```json\n{"a":1}\n```'), { a: 1 });
});

Deno.test("parses JSON with prose around", () => {
  assertEquals(parseAiJson('Voici le résultat :\n{"a":[1,2]}\nBonne journée !'), { a: [1, 2] });
});

Deno.test("ignores braces inside strings", () => {
  assertEquals(parseAiJson('blah {"a":"} not the end","b":2} tail'), { a: "} not the end", b: 2 });
});

Deno.test("tolerates trailing commas", () => {
  assertEquals(parseAiJson('{"a":1,"b":[1,2,],}'), { a: 1, b: [1, 2] });
});

Deno.test("parses arrays", () => {
  assertEquals(parseAiJson("texte [1,2,3]"), [1, 2, 3]);
});

Deno.test("returns null on garbage", () => {
  assertEquals(parseAiJson("désolé je ne peux pas"), null);
  assertEquals(parseAiJson(""), null);
});

Deno.test("truncateForLog truncates", () => {
  const out = truncateForLog("x".repeat(50), 10);
  assertEquals(out.startsWith("x".repeat(10)), true);
  assertEquals(out.includes("50 chars total"), true);
});
