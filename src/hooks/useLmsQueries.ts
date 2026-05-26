import { useQuery } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

// ---- Exported types ----

export interface CourseHomeDocument {
  label: string;
  url: string;
}

export interface CourseHomeInstructor {
  name?: string | null;
  subtitle?: string | null;
  photo_url?: string | null;
  note?: string | null;
  email?: string | null;
  phone?: string | null;
  cv_url?: string | null;
}

/** Editable content of the course-home "Infos pratiques" section. */
export interface CourseHomeConfig {
  welcome_title_1?: string | null;
  welcome_title_2?: string | null;
  tips?: string[];
  plan_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  period_note?: string | null;
  objectives?: string[];
  prerequisites?: string | null;
  documents?: CourseHomeDocument[];
  instructor?: CourseHomeInstructor | null;
}

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
  formation_configs?: { formation_name: string } | null;
  community_preview_count: number;
  welcome_video_url?: string | null;
  welcome_text?: string | null;
  home_config?: CourseHomeConfig | null;
}

export interface LmsModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  is_prerequisite_gated: boolean;
  is_special_section: boolean;
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
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  quiz_id: string | null;
  assignment_id: string | null;
  position: number;
  estimated_minutes: number;
  is_mandatory: boolean;
  /** Work-deposit feature (ST-2026-0043) — set by lesson editor in BO. */
  work_deposit_enabled?: boolean;
  work_deposit_config?: Record<string, unknown> | null;
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
  title: string | null;
  hint: string | null;
  explanation: string | null;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  difficulty_level: string | null;
  notion: string | null;
  multi_select: boolean;
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
  answers: Record<string, unknown>[];
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
  file_url?: string | null;
  file_name?: string | null;
}

export interface LmsAssignmentSubmission {
  id: string;
  lesson_id: string;
  learner_email: string;
  comment: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submitted_at: string;
  graded_at: string | null;
  graded_by: string | null;
}

export interface LmsBadge {
  id: string;
  course_id: string;
  learner_email: string;
  badge_type: string;
  badge_name: string;
  badge_icon: string;
  awarded_at: string;
  metadata: Record<string, unknown> | null;
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
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_courses")
        .select("*, formation_configs(formation_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as LmsCourse;
    },
  });
}

export function useLesson(id: string | undefined) {
  return useQuery({
    queryKey: ["lms-lesson", id],
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_lessons")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as LmsLesson;
    },
  });
}

export function useCourseModules(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-modules", courseId],
    enabled: !!courseId,
    staleTime: 0,
    refetchOnMount: "always",
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
    staleTime: 0,
    refetchOnMount: "always",
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

export function useCourseQuizzes(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-course-quizzes", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_quizzes")
        .select("*")
        .eq("course_id", courseId!)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data || []) as LmsQuiz[];
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
      return (data ?? []).map((q) => ({
        ...q,
        points: q.points ?? 0,
        options: (typeof q.options === "string" ? JSON.parse(q.options) : q.options ?? []) as LmsQuizQuestion["options"],
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
      const client = createLearnerClient(email!);
      const { data, error } = await client
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
      return data as { id: string; course_id: string; title: string; description: string | null; is_locked: boolean | null; created_at: string }[];
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

// ---- Assignment submissions ----

export function useLearnerSubmissions(lessonId: string | undefined, email: string | undefined) {
  return useQuery({
    queryKey: ["lms-assignment-submissions", lessonId, email],
    enabled: !!lessonId && !!email,
    queryFn: async () => {
      const client = createLearnerClient(email!);
      const { data, error } = await client
        .from("lms_assignment_submissions")
        .select("*")
        .eq("lesson_id", lessonId!)
        .eq("learner_email", email!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as LmsAssignmentSubmission[];
    },
  });
}

// ---- Badges ----

export function useLearnerBadges(email: string | undefined) {
  return useQuery({
    queryKey: ["lms-badge-awards", email],
    enabled: !!email,
    queryFn: async () => {
      const client = createLearnerClient(email!);
      const { data, error } = await client
        .from("lms_badge_awards")
        .select("*")
        .eq("learner_email", email!)
        .order("awarded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LmsBadge[];
    },
  });
}

// ---- Live meetings (course home page) ----

export interface CourseLiveMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  meeting_type: string;
  status: string;
  description: string | null;
  replay_url: string | null;
}

export interface CourseLiveData {
  training: {
    id: string;
    start_date: string | null;
    end_date: string | null;
    training_name: string;
  } | null;
  meetings: CourseLiveMeeting[];
}

export function useCourseLiveMeetings(courseId: string | undefined) {
  return useQuery({
    queryKey: ["course-live-meetings", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_live_meetings" as any, {
        p_course_id: courseId!,
      });
      if (error) throw error;
      const result = data as CourseLiveData;
      return {
        training: result?.training ?? null,
        meetings: result?.meetings ?? [],
      } as CourseLiveData;
    },
  });
}

export interface CourseTrainingSession {
  training: {
    id: string;
    start_date: string | null;
    end_date: string | null;
    training_name: string;
  };
  meetings: CourseLiveMeeting[];
}

export function useCourseTrainingSessionsAdmin(courseId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["course-training-sessions-admin", courseId],
    enabled: !!courseId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_training_sessions_admin" as any, {
        p_course_id: courseId!,
      });
      if (error) throw error;
      return (data as CourseTrainingSession[]) ?? [];
    },
  });
}

// ---- Page views ----

export function useLessonViewStats(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-page-views", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from("lms_page_views")
        .select("lesson_id, learner_email, viewed_at")
        .eq("course_id", courseId);
      if (error) throw error;
      return data || [];
    },
  });
}

// ---- Lesson comments ----

export function useLessonComments(lessonId: string | undefined, learnerEmail?: string) {
  return useQuery({
    queryKey: ["lms-lesson-comments", lessonId],
    enabled: !!lessonId,
    queryFn: async () => {
      if (!lessonId) return [];
      const client = learnerEmail ? createLearnerClient(learnerEmail) : supabase;
      const { data, error } = await client
        .from("lms_lesson_comments")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAllCourseComments(courseId: string | undefined) {
  return useQuery({
    queryKey: ["lms-all-comments", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      if (!courseId) return [];
      const { data, error } = await supabase
        .from("lms_lesson_comments")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
