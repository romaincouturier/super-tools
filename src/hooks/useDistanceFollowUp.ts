import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { todayAsISO } from "@/lib/dateFormatters";
import {
  computeFollowUp,
  summarizeFollowUp,
  type FollowUpResult,
  type LearnerActivity,
} from "@/lib/distanceFollowUp";

/**
 * Effectivité du suivi à distance pour un cours (indicateur 19).
 *
 * Aucune donnée nouvelle n'est collectée : tout vient des tables LMS
 * existantes. Ce qui manquait, c'était la lecture consolidée qu'un auditeur
 * puisse ouvrir en une fois.
 */

/** Délai sans activité au-delà duquel une relance s'impose, en jours. */
const DEFAULT_INACTIVITY_DAYS = 21;

export function useDistanceFollowUp(courseId: string | null) {
  const [results, setResults] = useState<FollowUpResult[]>([]);
  const [mandatoryCount, setMandatoryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!courseId) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // Les leçons obligatoires définissent l'attendu du parcours.
      const { data: modules } = await supabase
        .from("lms_modules")
        .select("id")
        .eq("course_id", courseId);
      const moduleIds = (modules ?? []).map((m) => m.id);

      const { data: lessons } = moduleIds.length
        ? await supabase
            .from("lms_lessons")
            .select("id, is_mandatory, quiz_id")
            .in("module_id", moduleIds)
        : { data: [] as { id: string; is_mandatory: boolean | null; quiz_id: string | null }[] };

      const mandatoryLessonIds = (lessons ?? [])
        .filter((l) => l.is_mandatory !== false)
        .map((l) => l.id);
      const lessonIds = (lessons ?? []).map((l) => l.id);

      const [enrollments, progress, views, quizAttempts, deposits, submissions] = await Promise.all([
        supabase.from("lms_enrollments").select("learner_email").eq("course_id", courseId),
        supabase
          .from("lms_progress")
          .select("learner_email, lesson_id, status, completed_at")
          .eq("course_id", courseId),
        supabase.from("lms_page_views").select("learner_email, lesson_id").eq("course_id", courseId),
        supabase
          .from("lms_quiz_attempts")
          .select("learner_email, quiz_id, passed, completed_at"),
        supabase
          .from("lms_work_deposits")
          .select("learner_email, lesson_id, created_at")
          .eq("course_id", courseId),
        lessonIds.length
          ? supabase
              .from("lms_assignment_submissions")
              .select("learner_email, lesson_id, submitted_at")
              .in("lesson_id", lessonIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Les tentatives de quiz ne portent pas le cours : on ne garde que
      // celles qui visent un quiz rattaché à une leçon de ce parcours.
      const courseQuizIds = new Set(
        (lessons ?? []).map((l) => l.quiz_id).filter((id): id is string => !!id),
      );

      const byLearner = new Map<string, LearnerActivity>();
      const ensure = (email: string): LearnerActivity => {
        const existing = byLearner.get(email);
        if (existing) return existing;
        const created: LearnerActivity = {
          learnerEmail: email,
          progress: [],
          views: [],
          quizAttempts: [],
          submittedWork: [],
        };
        byLearner.set(email, created);
        return created;
      };

      for (const e of enrollments.data ?? []) ensure(e.learner_email);
      for (const p of progress.data ?? []) {
        ensure(p.learner_email).progress.push({
          lesson_id: p.lesson_id,
          status: p.status,
          completed_at: p.completed_at,
        });
      }
      for (const v of views.data ?? []) {
        ensure(v.learner_email).views.push({ lesson_id: v.lesson_id });
      }
      for (const q of quizAttempts.data ?? []) {
        if (!q.quiz_id || !courseQuizIds.has(q.quiz_id)) continue;
        ensure(q.learner_email).quizAttempts.push({
          quiz_id: q.quiz_id,
          passed: q.passed,
          completed_at: q.completed_at,
        });
      }
      for (const d of deposits.data ?? []) {
        ensure(d.learner_email).submittedWork.push({
          lesson_id: d.lesson_id,
          created_at: d.created_at,
        });
      }
      for (const s of (submissions.data ?? []) as { learner_email: string; lesson_id: string | null; submitted_at: string }[]) {
        ensure(s.learner_email).submittedWork.push({
          lesson_id: s.lesson_id,
          created_at: s.submitted_at,
        });
      }

      const today = todayAsISO();
      setMandatoryCount(mandatoryLessonIds.length);
      setResults(
        [...byLearner.values()]
          .map((a) => computeFollowUp(a, mandatoryLessonIds, today, DEFAULT_INACTIVITY_DAYS))
          .sort((a, b) => a.learnerEmail.localeCompare(b.learnerEmail, "fr")),
      );
    } catch (err) {
      console.error("Error computing distance follow-up:", err);
      toastError(toast, "Impossible de calculer le suivi distanciel");
    } finally {
      setLoading(false);
    }
  }, [courseId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => summarizeFollowUp(results), [results]);

  return { results, summary, mandatoryCount, loading, refresh: load };
}
