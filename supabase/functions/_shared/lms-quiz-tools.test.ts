import { it, expect, vi } from "vitest";

// lms-tools.ts importe supabase-client.ts et sanitize-html depuis esm.sh :
// vitest ne résout pas les imports https (règle [064]).
vi.mock("./supabase-client.ts", () => ({ getSupabaseClient: () => ({}) }));
vi.mock("https://esm.sh/sanitize-html@2.17.0", async () => ({ default: (await import("sanitize-html")).default }));

const { validateLessonPatch, validateQuizQuestions } = await import("./lms-tools.ts");

const opt = (text: string, is_correct: boolean) => ({ text, is_correct });

it("quiz: single_choice requires exactly one correct option", () => {
  expect(() => validateQuizQuestions([{ question: "Q", type: "single_choice", options: [opt("a", true), opt("b", true)] }])).toThrow();
  const [q] = validateQuizQuestions([{ question: "Q", type: "single_choice", options: [opt("a", true), opt("b", false)] }]);
  expect(q.multi_select).toEqual(false);
  expect(q.question_type).toEqual("mcq");
  expect(q.options[0]).toEqual({ label: "a", is_correct: true });
});

it("quiz: multiple_choice needs at least one correct and 2+ options", () => {
  expect(() => validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", false), opt("b", false)] }])).toThrow();
  expect(() => validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", true)] }])).toThrow();
  expect(() => validateQuizQuestions([])).toThrow();
  const [q] = validateQuizQuestions([{ question: "Q", type: "multiple_choice", options: [opt("a", true), opt("b", true)] }]);
  expect(q.multi_select).toEqual(true);
});

it("lesson patch: rejects unknown fields and validates values", () => {
  expect(() => validateLessonPatch({ content_html: "x" })).toThrow("Fields not allowed");
  expect(() => validateLessonPatch({ estimated_minutes: 9999 })).toThrow();
  expect(() => validateLessonPatch({})).toThrow();
  expect(validateLessonPatch({ estimated_minutes: 15, title: " T " })).toEqual({ estimated_minutes: 15, title: "T" });
  expect(validateLessonPatch({ estimated_minutes: null })).toEqual({ estimated_minutes: null });
});
