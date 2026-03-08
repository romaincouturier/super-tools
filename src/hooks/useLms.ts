import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ---- Types ----
export interface LmsCourse {
  id: string;
  org_id: string | null;
  formation_config_id: string | null;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  difficulty_level: string | null;
  estimated_duration_minutes: number;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LmsModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  is_prerequisite_gated: boolean;
  prerequisite_module_id: string | null;
  unlock_after_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface LmsLesson {
  id: string;
  module_id: string;
  title: string;
  lesson_type: string;
  content_html: string | null;
  video_url: string | null;
  video_duration_seconds: number | null;
  quiz_id: string | null;
  assignment_id: string | null;
  position: number;
  estimated_minutes: number;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
}

export interface LmsQuiz {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  created_at: string;
  updated_at: string;
}

export interface LmsQuizQuestion {
  id: string;
  quiz_id: string;
  question_type: string;
  question_text: string;
  explanation: string | null;
  points: number;
  position: number;
  options: { label: string; is_correct: boolean; feedback?: string }[];
  correct_answer: string | null;
  media_url: string | null;
  created_at: string;
}

export interface LmsQuizAttempt {
  id: string;
  quiz_id: string;
  learner_email: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  passed: boolean | null;
  answers: any[];
  started_at: string;
  completed_at: string | null;
  time_spent_seconds: number | null;
}

export interface LmsProgress {
  id: string;
  course_id: string;
  lesson_id: string;
  learner_email: string;
  status: string;
  completed_at: string | null;
  time_spent_seconds: number;
  created_at: string;
}

export interface LmsAssignment {
  id: string;
  course_id: string;
  title: string;
  instructions_html: string | null;
  max_score: number;
  due_after_days: number | null;
  allow_late_submission: boolean;
  allowed_file_types: string[];
  max_file_size_mb: number;
}

export interface LmsEnrollment {
  id: string;
  course_id: string;
  learner_email: string;
  enrolled_at: string;
  completed_at: string | null;
  completion_percentage: number;
  status: string;
}

export interface LmsForumPost {
  id: string;
  forum_id: string;
  parent_post_id: string | null;
  author_email: string;
  content_html: string;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

// ---- Courses ----
export function useCourses() {
  return useQuery({
    queryKey: ["lms-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_courses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LmsCourse[];
    },
  });
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: ["lms-course", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_courses")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as LmsCourse;
    },
  });
}

export function useCourseModules(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-modules", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_modules")
        .select("*")
        .eq("course_id", courseId!)
        .order("position");
      if (error) throw error;
      return data as LmsModule[];
    },
  });
}

export function useModuleLessons(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["lms-lessons", moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .select("*")
        .eq("module_id", moduleId!)
        .order("position");
      if (error) throw error;
      return data as LmsLesson[];
    },
  });
}

export function useCourseLessons(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-course-lessons", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data: modules, error: mErr } = await supabase
        .from("lms_modules")
        .select("id")
        .eq("course_id", courseId!);
      if (mErr) throw mErr;
      if (!modules?.length) return [];
      const moduleIds = modules.map((m) => m.id);
      const { data, error } = await supabase
        .from("lms_lessons")
        .select("*")
        .in("module_id", moduleIds)
        .order("position");
      if (error) throw error;
      return data as LmsLesson[];
    },
  });
}

// ---- Quiz ----
export function useQuiz(quizId: string | undefined) {
  return useQuery({
    queryKey: ["lms-quiz", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_quizzes")
        .select("*")
        .eq("id", quizId!)
        .single();
      if (error) throw error;
      return data as LmsQuiz;
    },
  });
}

export function useQuizQuestions(quizId: string | undefined) {
  return useQuery({
    queryKey: ["lms-quiz-questions", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_quiz_questions")
        .select("*")
        .eq("quiz_id", quizId!)
        .order("position");
      if (error) throw error;
      return (data ?? []).map((q: any) => ({
        ...q,
        options: typeof q.options === "string" ? JSON.parse(q.options) : q.options ?? [],
      })) as LmsQuizQuestion[];
    },
  });
}

// ---- Progress ----
export function useLearnerProgress(courseId: string | undefined, email: string | undefined) {
  return useQuery({
    queryKey: ["lms-progress", courseId, email],
    enabled: !!courseId && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_progress")
        .select("*")
        .eq("course_id", courseId!)
        .eq("learner_email", email!);
      if (error) throw error;
      return data as LmsProgress[];
    },
  });
}

// ---- Enrollments ----
export function useCourseEnrollments(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-enrollments", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_enrollments")
        .select("*")
        .eq("course_id", courseId!);
      if (error) throw error;
      return data as LmsEnrollment[];
    },
  });
}

// ---- Forums ----
export function useCourseForums(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-forums", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_forums")
        .select("*")
        .eq("course_id", courseId!);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useForumPosts(forumId: string | undefined) {
  return useQuery({
    queryKey: ["lms-forum-posts", forumId],
    enabled: !!forumId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_forum_posts")
        .select("*")
        .eq("forum_id", forumId!)
        .eq("is_deleted", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as LmsForumPost[];
    },
  });
}

// ---- Mutations ----
export function useCreateCourse() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<LmsCourse>) => {
      const { data, error } = await supabase
        .from("lms_courses")
        .insert(input as any)
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
        .update({ ...input, updated_at: new Date().toISOString() } as any)
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
        .insert(input as any)
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
        .update({ ...input, updated_at: new Date().toISOString() } as any)
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

// ---- Lesson mutations ----
export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsLesson> & { module_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .insert(input as any)
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
        .update({ ...input, updated_at: new Date().toISOString() } as any)
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

// ---- Quiz mutations ----
export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsQuiz> & { course_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("lms_quizzes")
        .insert(input as any)
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
        .insert(input as any)
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

// ---- Submit quiz attempt ----
export function useSubmitQuizAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsQuizAttempt> & { quiz_id: string; learner_email: string }) => {
      const { data, error } = await supabase
        .from("lms_quiz_attempts")
        .insert(input as any)
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

// ---- Mark lesson complete ----
export function useMarkLessonComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { course_id: string; lesson_id: string; learner_email: string }) => {
      const { data, error } = await supabase
        .from("lms_progress")
        .upsert(
          {
            course_id: input.course_id,
            lesson_id: input.lesson_id,
            learner_email: input.learner_email,
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
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
      const { data, error } = await supabase
        .from("lms_enrollments")
        .upsert(input as any, { onConflict: "course_id,learner_email" })
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

// ---- Forum mutations ----
export function useCreateForumPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<LmsForumPost> & { forum_id: string; author_email: string; content_html: string }) => {
      const { data, error } = await supabase
        .from("lms_forum_posts")
        .insert(input as any)
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
