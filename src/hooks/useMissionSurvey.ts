import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  type: "text" | "textarea" | "single_choice" | "multiple_choice" | "rating" | "nps" | "date";
  label: string;
  description: string | null;
  required: boolean;
  position: number;
  options: { label: string }[] | null;
  settings: Record<string, unknown> | null;
  created_at: string;
}

export interface Survey {
  id: string;
  mission_page_id: string;
  mission_id: string;
  title: string;
  intro_message: string | null;
  thank_you_message: string;
  public_token: string;
  recipient_emails: string[];
  is_active: boolean;
  require_identity: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string;
}

export interface SurveyAnswer {
  id: string;
  response_id: string;
  question_id: string;
  value: string | null;
  values: string[] | null;
}

const SURVEY_KEY = "mission_surveys";

// ── Fetch or create survey for a page ────────────────────────────────

export const useSurveyByPageId = (pageId: string) =>
  useQuery({
    queryKey: [SURVEY_KEY, "page", pageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mission_surveys")
        .select("*")
        .eq("mission_page_id", pageId)
        .maybeSingle();
      if (error) throw error;
      return data as Survey | null;
    },
    enabled: !!pageId,
  });

export const useSurveyByToken = (token: string) =>
  useQuery({
    queryKey: [SURVEY_KEY, "token", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_mission_survey_by_token", { p_token: token });
      if (error) throw error;
      return (data as (Survey & { mission_survey_questions: SurveyQuestion[] }) | null) ?? null;
    },
    enabled: !!token,
  });

export const useCreateSurvey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { mission_page_id: string; mission_id: string; title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("mission_surveys")
        .insert({ ...input, created_by: user?.email ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Survey;
    },
    onSuccess: (s) => qc.invalidateQueries({ queryKey: [SURVEY_KEY, "page", s.mission_page_id] }),
  });
};

export const useUpdateSurvey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Survey> }) => {
      const { error } = await (supabase as any)
        .from("mission_surveys")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [SURVEY_KEY] }),
  });
};

// ── Questions ─────────────────────────────────────────────────────────

export const useSurveyQuestions = (surveyId: string) =>
  useQuery({
    queryKey: [SURVEY_KEY, "questions", surveyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mission_survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as SurveyQuestion[];
    },
    enabled: !!surveyId,
  });

export const useUpsertSurveyQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Partial<SurveyQuestion> & { survey_id: string }) => {
      if (q.id) {
        const { id, survey_id: _sid, created_at: _ca, ...updates } = q as SurveyQuestion;
        const { error } = await (supabase as any)
          .from("mission_survey_questions")
          .update(updates)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("mission_survey_questions").insert(q);
        if (error) throw error;
      }
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [SURVEY_KEY, "questions", v.survey_id] }),
  });
};

export const useDeleteSurveyQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, surveyId }: { id: string; surveyId: string }) => {
      const { error } = await (supabase as any).from("mission_survey_questions").delete().eq("id", id);
      if (error) throw error;
      return surveyId;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [SURVEY_KEY, "questions", v.surveyId] }),
  });
};

export const useReorderSurveyQuestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ surveyId, ordered }: { surveyId: string; ordered: { id: string; position: number }[] }) => {
      await Promise.all(
        ordered.map(({ id, position }) =>
          (supabase as any).from("mission_survey_questions").update({ position }).eq("id", id)
        )
      );
      return surveyId;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [SURVEY_KEY, "questions", v.surveyId] }),
  });
};

// ── Responses ─────────────────────────────────────────────────────────

export const useSurveyResponses = (surveyId: string) =>
  useQuery({
    queryKey: [SURVEY_KEY, "responses", surveyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mission_survey_responses")
        .select("*, mission_survey_answers(*)")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (SurveyResponse & { mission_survey_answers: SurveyAnswer[] })[];
    },
    enabled: !!surveyId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

export const useSubmitSurveyResponse = () =>
  useMutation({
    mutationFn: async ({
      surveyId,
      respondentName,
      respondentEmail,
      answers,
    }: {
      surveyId: string;
      respondentName: string;
      respondentEmail: string;
      answers: { questionId: string; value?: string; values?: string[] }[];
    }) => {
      // Generate the response id client-side so anonymous submitters don't
      // need SELECT permission on mission_survey_responses to read it back.
      const responseId = crypto.randomUUID();
      const { error: re } = await (supabase as any)
        .from("mission_survey_responses")
        .insert({
          id: responseId,
          survey_id: surveyId,
          respondent_name: respondentName || null,
          respondent_email: respondentEmail || null,
        });
      if (re) throw re;
      const answerRows = answers.map((a) => ({
        response_id: responseId,
        question_id: a.questionId,
        value: a.value ?? null,
        values: a.values ?? null,
      }));
      if (answerRows.length > 0) {
        const { error: ae } = await (supabase as any).from("mission_survey_answers").insert(answerRows);
        if (ae) throw ae;
      }
      // Notify the staff user who created the survey (fire-and-forget).
      supabase.functions
        .invoke("notify-survey-response", { body: { responseId, surveyId } })
        .catch((err) => console.error("notify-survey-response failed", err));
    },
  });
