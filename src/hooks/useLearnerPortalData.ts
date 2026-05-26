import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
export function usePracticeDeposits(courseIds: string[]) {
  return useQuery({
    queryKey: ["practice_deposits", courseIds],
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
      return data || [];
    },
    enabled: courseIds.length > 0,
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
