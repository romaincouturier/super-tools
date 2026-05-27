import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useCourse,
  useLesson,
  useCourseModules,
  useModuleLessons,
  useCourseLessons,
  useQuizQuestions,
  useLearnerProgress,
  useLearnerBadges,
  useLessonComments,
  useAllCourseComments,
  useCourseLiveMeetings,
} from "./useLmsQueries";

// ── Mock ──────────────────────────────────────────────────────────────────────

const { mockFrom, mockRpc, setTableResult, clearResults } = vi.hoisted(() => {
  const tableResults = new Map<string, { data: unknown; error: unknown }>();

  function makeChain(table?: string): any {
    const result = tableResults.get(table ?? "") ?? { data: null, error: null };
    const p = Promise.resolve(result);
    return new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") return p.then.bind(p);
          if (prop === "catch") return p.catch.bind(p);
          if (prop === "finally") return p.finally.bind(p);
          return vi.fn().mockReturnValue(makeChain(table));
        },
      },
    );
  }

  const mockRpc = vi.fn((_name: string) => Promise.resolve({ data: null, error: null }));
  const mockFrom = vi.fn((table: string) => makeChain(table));

  const setTableResult = (table: string, result: { data: unknown; error: unknown }) => {
    tableResults.set(table, result);
  };
  const clearResults = () => tableResults.clear();

  return { mockFrom, mockRpc, setTableResult, clearResults };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
  createLearnerClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearResults();
});

// ── useCourse ─────────────────────────────────────────────────────────────────

describe("useCourse", () => {
  it("is disabled when id is undefined", () => {
    const { result } = renderHook(() => useCourse(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("fetches course by id", async () => {
    const course = { id: "c1", title: "Formation Excel", status: "published" };
    setTableResult("lms_courses", { data: course, error: null });
    const { result } = renderHook(() => useCourse("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith("lms_courses");
    expect(result.current.data).toMatchObject({ id: "c1", title: "Formation Excel" });
  });

  it("propagates errors", async () => {
    setTableResult("lms_courses", { data: null, error: { message: "not found" } });
    const { result } = renderHook(() => useCourse("c-missing"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useLesson ─────────────────────────────────────────────────────────────────

describe("useLesson", () => {
  it("is disabled when id is undefined", () => {
    const { result } = renderHook(() => useLesson(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches lesson by id", async () => {
    const lesson = { id: "l1", title: "Intro", lesson_type: "video", position: 1 };
    setTableResult("lms_lessons", { data: lesson, error: null });
    const { result } = renderHook(() => useLesson("l1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ id: "l1", title: "Intro" });
  });
});

// ── useCourseModules ──────────────────────────────────────────────────────────

describe("useCourseModules", () => {
  it("is disabled when courseId is undefined", () => {
    const { result } = renderHook(() => useCourseModules(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns modules ordered by position", async () => {
    const modules = [
      { id: "m1", course_id: "c1", title: "Module 1", position: 1 },
      { id: "m2", course_id: "c1", title: "Module 2", position: 2 },
    ];
    setTableResult("lms_modules", { data: modules, error: null });
    const { result } = renderHook(() => useCourseModules("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].title).toBe("Module 1");
  });
});

// ── useModuleLessons ──────────────────────────────────────────────────────────

describe("useModuleLessons", () => {
  it("is disabled when moduleId is undefined", () => {
    const { result } = renderHook(() => useModuleLessons(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns lessons for a module", async () => {
    const lessons = [{ id: "l1", module_id: "m1", title: "Leçon 1", position: 1 }];
    setTableResult("lms_lessons", { data: lessons, error: null });
    const { result } = renderHook(() => useModuleLessons("m1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].module_id).toBe("m1");
  });
});

// ── useCourseLessons ──────────────────────────────────────────────────────────

describe("useCourseLessons", () => {
  it("is disabled when courseId is undefined", () => {
    const { result } = renderHook(() => useCourseLessons(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns empty array when course has no modules", async () => {
    setTableResult("lms_modules", { data: [], error: null });
    const { result } = renderHook(() => useCourseLessons("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    // Should NOT query lms_lessons if no modules
    expect(mockFrom).not.toHaveBeenCalledWith("lms_lessons");
  });

  it("fetches lessons across all modules of a course", async () => {
    setTableResult("lms_modules", { data: [{ id: "m1" }, { id: "m2" }], error: null });
    setTableResult("lms_lessons", {
      data: [
        { id: "l1", module_id: "m1", title: "Leçon 1", position: 1 },
        { id: "l2", module_id: "m2", title: "Leçon 2", position: 1 },
      ],
      error: null,
    });
    const { result } = renderHook(() => useCourseLessons("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith("lms_modules");
    expect(mockFrom).toHaveBeenCalledWith("lms_lessons");
    expect(result.current.data).toHaveLength(2);
  });

  it("propagates module fetch errors", async () => {
    setTableResult("lms_modules", { data: null, error: { message: "RLS denied" } });
    const { result } = renderHook(() => useCourseLessons("c1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useQuizQuestions ──────────────────────────────────────────────────────────

describe("useQuizQuestions", () => {
  it("is disabled when quizId is undefined", () => {
    const { result } = renderHook(() => useQuizQuestions(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("maps questions and defaults points to 0 when null", async () => {
    setTableResult("lms_quiz_questions", {
      data: [
        {
          id: "q1", quiz_id: "qz1", question_text: "Q1", points: null,
          options: [{ label: "A", is_correct: true }], position: 1,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useQuizQuestions("qz1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].points).toBe(0);
  });

  it("parses options from JSON string (legacy format)", async () => {
    const rawOptions = JSON.stringify([{ label: "A", is_correct: true }]);
    setTableResult("lms_quiz_questions", {
      data: [
        { id: "q2", quiz_id: "qz1", question_text: "Q2", points: 2, options: rawOptions, position: 2 },
      ],
      error: null,
    });
    const { result } = renderHook(() => useQuizQuestions("qz1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data![0].options)).toBe(true);
    expect(result.current.data![0].options[0].label).toBe("A");
  });

  it("handles options already as array (new format)", async () => {
    setTableResult("lms_quiz_questions", {
      data: [
        {
          id: "q3", quiz_id: "qz1", question_text: "Q3", points: 1,
          options: [{ label: "B", is_correct: false }], position: 3,
        },
      ],
      error: null,
    });
    const { result } = renderHook(() => useQuizQuestions("qz1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].options[0].label).toBe("B");
  });

  it("handles null options gracefully (returns empty array)", async () => {
    setTableResult("lms_quiz_questions", {
      data: [{ id: "q4", quiz_id: "qz1", question_text: "Q4", points: 1, options: null, position: 4 }],
      error: null,
    });
    const { result } = renderHook(() => useQuizQuestions("qz1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].options).toEqual([]);
  });
});

// ── useLearnerProgress ────────────────────────────────────────────────────────

describe("useLearnerProgress", () => {
  it("is disabled when courseId is undefined", () => {
    const { result } = renderHook(() => useLearnerProgress(undefined, "a@b.com"), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when email is undefined", () => {
    const { result } = renderHook(() => useLearnerProgress("c1", undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("uses createLearnerClient and returns progress", async () => {
    const progress = [{ id: "p1", course_id: "c1", lesson_id: "l1", status: "completed" }];
    setTableResult("lms_progress", { data: progress, error: null });
    const { result } = renderHook(() => useLearnerProgress("c1", "alice@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFrom).toHaveBeenCalledWith("lms_progress");
    expect(result.current.data).toHaveLength(1);
  });
});

// ── useLearnerBadges ──────────────────────────────────────────────────────────

describe("useLearnerBadges", () => {
  it("is disabled when email is undefined", () => {
    const { result } = renderHook(() => useLearnerBadges(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches badges for the learner", async () => {
    const badges = [{ id: "b1", badge_type: "completion", badge_name: "Finisseur" }];
    setTableResult("lms_badge_awards", { data: badges, error: null });
    const { result } = renderHook(() => useLearnerBadges("alice@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0]).toMatchObject({ badge_name: "Finisseur" });
  });

  it("returns empty array when learner has no badges", async () => {
    setTableResult("lms_badge_awards", { data: null, error: null });
    const { result } = renderHook(() => useLearnerBadges("alice@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// ── useLessonComments ─────────────────────────────────────────────────────────

describe("useLessonComments", () => {
  it("is disabled when lessonId is undefined", () => {
    const { result } = renderHook(() => useLessonComments(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("fetches comments without auth (anon supabase)", async () => {
    const comments = [{ id: "cm1", content: "Bravo !", lesson_id: "l1" }];
    setTableResult("lms_lesson_comments", { data: comments, error: null });
    const { result } = renderHook(() => useLessonComments("l1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("fetches comments with learner auth (createLearnerClient)", async () => {
    const comments = [{ id: "cm2", content: "Question", lesson_id: "l1" }];
    setTableResult("lms_lesson_comments", { data: comments, error: null });
    const { result } = renderHook(() => useLessonComments("l1", "alice@x.com"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

// ── useAllCourseComments ──────────────────────────────────────────────────────

describe("useAllCourseComments", () => {
  it("is disabled when courseId is undefined", () => {
    const { result } = renderHook(() => useAllCourseComments(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("returns all comments for a course", async () => {
    setTableResult("lms_lesson_comments", {
      data: [{ id: "c1", course_id: "course-1" }, { id: "c2", course_id: "course-1" }],
      error: null,
    });
    const { result } = renderHook(() => useAllCourseComments("course-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});

// ── useCourseLiveMeetings ─────────────────────────────────────────────────────

describe("useCourseLiveMeetings", () => {
  it("is disabled when courseId is undefined", () => {
    const { result } = renderHook(() => useCourseLiveMeetings(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls get_course_live_meetings RPC and returns structured data", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        training: { id: "t1", start_date: "2026-06-01", end_date: "2026-06-30", training_name: "Excel Pro" },
        meetings: [{ id: "m1", title: "Session 1", status: "scheduled" }],
      },
      error: null,
    });
    const { result } = renderHook(() => useCourseLiveMeetings("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.training?.training_name).toBe("Excel Pro");
    expect(result.current.data!.meetings).toHaveLength(1);
  });

  it("returns empty meetings when RPC returns null", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => useCourseLiveMeetings("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.meetings).toEqual([]);
    expect(result.current.data!.training).toBeNull();
  });
});
