import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import type {
  LmsCourse,
  LmsModule,
  LmsLesson,
  LmsQuiz,
  LmsQuizQuestion,
  LmsQuizAttempt,
  LmsForumPost,
  LmsAssignmentSubmission,
} from "./useLmsQueries";

type Tables = Database["public"]["Tables"];
type LmsCourseInsert = Tables["lms_courses"]["Insert"];
type LmsCourseUpdate = Tables["lms_courses"]["Update"];
type LmsModuleInsert = Tables["lms_modules"]["Insert"];
type LmsModuleUpdate = Tables["lms_modules"]["Update"];
type LmsLessonInsert = Tables["lms_lessons"]["Insert"];
type LmsLessonUpdate = Tables["lms_lessons"]["Update"];
type LmsQuizInsert = Tables["lms_quizzes"]["Insert"];
type LmsQuizQuestionInsert = Tables["lms_quiz_questions"]["Insert"];
type LmsQuizAttemptInsert = Tables["lms_quiz_attempts"]["Insert"];
type LmsProgressInsert = Tables["lms_progress"]["Insert"];
type LmsEnrollmentInsert = Tables["lms_enrollments"]["Insert"];
type LmsAssignmentSubmissionInsert = Tables["lms_assignment_submissions"]["Insert"];
type LmsForumPostInsert = Tables["lms_forum_posts"]["Insert"];

// ---- Course mutations ----

export function useCreateCourse() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<LmsCourse>) => {
      const { data, error } = await supabase
        .from("lms_courses")
        .insert(input as LmsCourseInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-courses"] });
      toast({ title: "Cours créé" });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LmsCourse> & { id: string }) => {
      const { data, error } = await supabase
        .from("lms_courses")
        .update({ ...input, updated_at: new Date().toISOString() } as LmsCourseUpdate)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-courses"] });
      qc.invalidateQueries({ queryKey: ["lms-course", vars.id] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-courses"] });
      toast({ title: "Cours supprimé" });
    },
  });
}

// ---- Module mutations ----

export function useCreateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsModule> & { course_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("lms_modules")
        .insert(input as LmsModuleInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-modules", vars.course_id] });
    },
  });
}

export function useUpdateModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LmsModule> & { id: string }) => {
      const { data, error } = await supabase
        .from("lms_modules")
        .update({ ...input, updated_at: new Date().toISOString() } as LmsModuleUpdate)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules"] });
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules"] });
    },
  });
}

export function useReorderModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modules: { id: string; position: number }[]) => {
      for (const m of modules) {
        const { error } = await supabase
          .from("lms_modules")
          .update({ position: m.position })
          .eq("id", m.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-modules"] });
      qc.invalidateQueries({ queryKey: ["lms-course-lessons"] });
    },
  });
}

// ---- Lesson mutations ----

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsLesson> & { module_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .insert(input as LmsLessonInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-lessons", vars.module_id] });
      qc.invalidateQueries({ queryKey: ["lms-course-lessons"] });
    },
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LmsLesson> & { id: string }) => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .update({ ...input, updated_at: new Date().toISOString() } as LmsLessonUpdate)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-lessons"] });
      qc.invalidateQueries({ queryKey: ["lms-course-lessons"] });
    },
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-lessons"] });
      qc.invalidateQueries({ queryKey: ["lms-course-lessons"] });
    },
  });
}

export function useReorderLessons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessons: { id: string; position: number }[]) => {
      for (const l of lessons) {
        const { error } = await supabase
          .from("lms_lessons")
          .update({ position: l.position })
          .eq("id", l.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-lessons"] });
      qc.invalidateQueries({ queryKey: ["lms-course-lessons"] });
    },
  });
}

// ---- Quiz mutations ----

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsQuiz> & { course_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("lms_quizzes")
        .insert(input as LmsQuizInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-quiz"] });
    },
  });
}

export function useCreateQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsQuizQuestion> & { quiz_id: string }) => {
      const { data, error } = await supabase
        .from("lms_quiz_questions")
        .insert(input as LmsQuizQuestionInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-quiz-questions", vars.quiz_id] });
    },
  });
}

export function useSubmitQuizAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsQuizAttempt> & { quiz_id: string; learner_email: string }) => {
      const client = createLearnerClient(input.learner_email);
      const { data, error } = await client
        .from("lms_quiz_attempts")
        .insert(input as LmsQuizAttemptInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-quiz-attempts", vars.quiz_id] });
    },
  });
}

// ---- Progress mutations ----

export function useMarkLessonComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { course_id: string; lesson_id: string; learner_email: string }) => {
      const client = createLearnerClient(input.learner_email);
      const { data, error } = await client
        .from("lms_progress")
        .upsert(
          {
            course_id: input.course_id,
            lesson_id: input.lesson_id,
            learner_email: input.learner_email,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as LmsProgressInsert,
          { onConflict: "lesson_id,learner_email" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-progress"] });
    },
  });
}

// ---- Enrollment mutations ----

export function useEnrollLearner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { course_id: string; learner_email: string }) => {
      const client = createLearnerClient(input.learner_email);
      const { data, error } = await client
        .from("lms_enrollments")
        .upsert(input as LmsEnrollmentInsert, { onConflict: "course_id,learner_email" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-enrollments", vars.course_id] });
    },
  });
}

// ---- Assignment mutations ----

export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lesson_id: string; learner_email: string; comment?: string; file_url?: string; file_name?: string; file_size?: number }) => {
      const client = createLearnerClient(input.learner_email);
      const { data, error } = await client
        .from("lms_assignment_submissions")
        .insert(input as LmsAssignmentSubmissionInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms-assignment-submissions"] });
    },
  });
}

// ---- Forum mutations ----

export function useCreateForumPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsForumPost> & { forum_id: string; author_email: string; content_html: string; file_url?: string | null; file_name?: string | null }) => {
      const client = createLearnerClient(input.author_email);
      const { data, error } = await client
        .from("lms_forum_posts")
        .insert(input as LmsForumPostInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-forum-posts", vars.forum_id] });
    },
  });
}

// ---- Page view tracking ----

export function useTrackPageView() {
  return useMutation({
    mutationFn: async ({ courseId, lessonId, learnerEmail }: { courseId: string; lessonId: string; learnerEmail: string }) => {
      const client = learnerEmail ? createLearnerClient(learnerEmail) : supabase;
      const { error } = await client
        .from("lms_page_views")
        .insert({ course_id: courseId, lesson_id: lessonId, learner_email: learnerEmail || "admin-preview" } as any);
      if (error) console.warn("Page view tracking error:", error);
    },
  });
}

// ---- Lesson comment mutations ----

export function usePostLessonComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { courseId: string; lessonId: string; learnerEmail: string; learnerName: string; content: string }) => {
      const client = createLearnerClient(input.learnerEmail);
      const { error } = await client
        .from("lms_lesson_comments")
        .insert({
          course_id: input.courseId,
          lesson_id: input.lessonId,
          learner_email: input.learnerEmail,
          learner_name: input.learnerName,
          content: input.content,
        } as any);
      if (error) throw error;

      // Notify admin
      try {
        await supabase.functions.invoke("notify-lms-comment", {
          body: {
            lessonId: input.lessonId,
            courseId: input.courseId,
            learnerEmail: input.learnerEmail,
            learnerName: input.learnerName,
            comment: input.content,
          },
        });
      } catch (e) {
        console.warn("Failed to notify admin:", e);
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["lms-lesson-comments", vars.lessonId] });
    },
  });
}
