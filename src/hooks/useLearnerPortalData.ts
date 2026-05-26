import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { uploadDepositFile, createDeposit } from "@/services/lms-work-deposit";

// Dépôts de travaux de l'apprenant
export function useLearnerWorkDeposits(email: string | null) {
  return useQuery({
    queryKey: ["learner_work_deposits", email],
    queryFn: async () => {
      if (!email) return [];
      const { data, error } = await (supabase as any)
        .from("lms_work_deposits")
        .select(`
          id, lesson_id, course_id, file_name, file_url, file_mime,
          comment, visibility, publication_status, pedagogical_status,
          created_at, updated_at,
          lms_courses ( title ),
          lms_lessons ( title )
        `)
        .eq("learner_email", email.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!email,
  });
}

// Mutation pour déposer un travail portfolio (libre, sans leçon)
export function useCreatePortfolioDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      caption,
      courseId,
      learnerEmail,
    }: {
      file: File;
      caption: string;
      courseId: string | null;
      learnerEmail: string;
    }) => {
      const uploaded = await uploadDepositFile(file, null, learnerEmail);
      return createDeposit({
        lesson_id: null,
        course_id: courseId,
        learner_email: learnerEmail,
        file_url: uploaded.url,
        file_name: uploaded.name,
        file_size: uploaded.size,
        file_mime: uploaded.mime,
        comment: caption || null,
        visibility: "shared",
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["learner_work_deposits", variables.learnerEmail] });
    },
  });
}

// Dépôts partagés des autres apprenants (Espace de pratique)
export function usePracticeDeposits(courseIds: string[], learnerEmail?: string | null) {
  return useQuery({
    queryKey: ["practice_deposits", courseIds, learnerEmail ?? null],
    queryFn: async () => {
      if (!courseIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("lms_work_deposits")
        .select("id, lesson_id, course_id, learner_email, file_name, file_url, file_mime, comment, created_at")
        .in("course_id", courseIds)
        .eq("publication_status", "published")
        .eq("visibility", "shared")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const deposits = (data || []) as any[];
      if (!deposits.length) return deposits;

      const ids = deposits.map((d) => d.id);
      const [reactionsRes, commentsRes] = await Promise.all([
        (supabase as any).from("lms_deposit_reactions").select("deposit_id, author_email").in("deposit_id", ids),
        (supabase as any).from("lms_deposit_comments").select("id, deposit_id, status").in("deposit_id", ids),
      ]);
      const reactions: any[] = reactionsRes.data || [];
      const comments: any[] = (commentsRes.data || []).filter((c: any) => c.status === "published");
      const email = (learnerEmail || "").toLowerCase();
      return deposits.map((d) => {
        const dr = reactions.filter((r) => r.deposit_id === d.id);
        return {
          ...d,
          reaction_count: dr.length,
          i_reacted: email ? dr.some((r) => (r.author_email || "").toLowerCase() === email) : false,
          comment_count: comments.filter((c) => c.deposit_id === d.id).length,
        };
      });
    },
    enabled: courseIds.length > 0,
  });
}

// Toggle like on a shared deposit (learner)
export function useToggleDepositReaction(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ depositId, iReacted }: { depositId: string; iReacted: boolean }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const { createLearnerClient } = await import("@/integrations/supabase/client");
      const c = createLearnerClient(learnerEmail) as any;
      if (iReacted) {
        const { error } = await c.from("lms_deposit_reactions")
          .delete().eq("deposit_id", depositId).eq("author_email", learnerEmail);
        if (error) throw error;
      } else {
        const { error } = await c.from("lms_deposit_reactions")
          .insert({ deposit_id: depositId, author_email: learnerEmail });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["practice_deposits"] }),
  });
}

// Derniers commentaires reçus (de la part d'autres apprenants sur les leçons du cours)
export function useLearnerReceivedComments(email: string | null, courseIds: string[]) {
  return useQuery({
    queryKey: ["learner_received_comments", email, courseIds],
    queryFn: async () => {
      if (!email || !courseIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("lms_lesson_comments")
        .select("id, content, learner_email, learner_name, lesson_id, course_id, created_at")
        .in("course_id", courseIds)
        .neq("learner_email", email.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!email && courseIds.length > 0,
  });
}

// Page views du cours principal (pour "À faire ensuite")
export function useCoursePageViews(courseId: string | null, email: string | null) {
  return useQuery({
    queryKey: ["course_page_views", courseId, email],
    queryFn: async () => {
      if (!courseId || !email) return [];
      const { data, error } = await (supabase as any)
        .from("lms_page_views")
        .select("lesson_id")
        .eq("course_id", courseId)
        .eq("learner_email", email.toLowerCase());
      if (error) throw error;
      return (data || []).map((r: any) => r.lesson_id as string);
    },
    enabled: !!courseId && !!email,
  });
}
