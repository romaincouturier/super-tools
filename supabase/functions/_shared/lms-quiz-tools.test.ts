import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateLessonPatch, validateQuizQuestions } from "./lms-tools.ts";

const opt = (text: string, is_correct: boolean) => ({ text, is_correct });

Deno.test("quiz: single_choice requires exactly one correct option", () => {
  assertThrows(() => validateQuizQuestions([{ question: "Q", type: "single_choice", options: [opt("a", true), opt("b", true)] }]));
  const [q] = validateQuizQuestions([{ question: "Q", type: "single_choice", options: [opt("a", true), opt("b", false)] }]);
  assertEquals(q.multi_select, false);
  assertEquals(q.question_type, "mcq");
  assertEquals(q.options[0], { label: "a", is_correct: true });
});

Deno.test("quiz: multiple_choice needs at least one correct and 2+ options", () => {
  assertThrows(() => validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", false), opt("b", false)] }]));
  assertThrows(() => validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", true)] }]));
  assertThrows(() => validateQuizQuestions([]));
  const [q] = validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", true), opt("b", true)] }]);
  assertEquals(q.multi_select, true);
});

Deno.test("lesson patch: rejects unknown fields and validates values", () => {
  assertThrows(() => validateLessonPatch({ content_html: "x" }), Error, "Fields not allowed");
  assertThrows(() => validateLessonPatch({ estimated_minutes: 9999 }));
  assertThrows(() => validateLessonPatch({}));
  assertEquals(validateLessonPatch({ estimated_minutes: 15, title: " T " }), { estimated_minutes: 15, title: "T" });
  assertEquals(validateLessonPatch({ estimated_minutes: null }), { estimated_minutes: null });
});
