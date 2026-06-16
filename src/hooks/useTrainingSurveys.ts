import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingSurveyQuestion {
  id: string;
  survey_id: string;
  type: "text" | "textarea" | "single_choice" | "multiple_choice" | "rating" | "nps" | "date";
  label: string;
  description: string | null;
  required: boolean;
  position: number;
  options: { label: string }[] | null;
  created_at: string;
}

export interface TrainingSurvey {
  id: string;
  training_id: string;
  title: string;
  intro_message: string | null;
  email_subject: string | null;
  email_body: string | null;
  thank_you_message: string;
  closes_at: string | null;
  is_active: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingSurveyResponseRow {
  id: string;
  survey_id: string;
  recipient_id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  submitted_at: string;
  training_survey_answers: {
    id: string;
    question_id: string;
    value: string | null;
    values: string[] | null;
  }[];
}

const KEY = "training_surveys";

export const useTrainingSurvey = (trainingId: string) =>
  useQuery({
    queryKey: [KEY, "training", trainingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_surveys")
        .select("*")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as TrainingSurvey | null;
    },
    enabled: !!trainingId,
  });

export const useTrainingSurveysList = (trainingId: string) =>
  useQuery({
    queryKey: [KEY, "list", trainingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_surveys")
        .select("*")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingSurvey[];
    },
    enabled: !!trainingId,
  });

export const useDuplicateTrainingSurvey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceSurveyId: string) => {
      const { data: src, error: srcErr } = await (supabase as any)
        .from("training_surveys").select("*").eq("id", sourceSurveyId).single();
      if (srcErr) throw srcErr;
      const { data: { user } } = await supabase.auth.getUser();
      const waveMatch = (src.title || "").match(/vague\s+(\d+)\s*$/i);
      const baseTitle = (src.title || "Sondage").replace(/\s*[—\-·]?\s*vague\s+\d+\s*$/i, "").trim();
      const nextNum = (waveMatch ? Number(waveMatch[1]) : 1) + 1;
      const newTitle = `${baseTitle} — Vague ${nextNum}`;
      const { data: newSurvey, error } = await (supabase as any)
        .from("training_surveys")
        .insert({
          training_id: src.training_id,
          title: newTitle,
          intro_message: src.intro_message,
          email_subject: src.email_subject,
          email_body: src.email_body,
          thank_you_message: src.thank_you_message,
          closes_at: null,
          is_active: true,
          created_by: user?.id,
        })
        .select().single();
      if (error) throw error;

      const { data: questions } = await (supabase as any)
        .from("training_survey_questions").select("*")
        .eq("survey_id", sourceSurveyId).order("position");
      if (questions && questions.length) {
        const cloned = questions.map((q: any) => ({
          survey_id: newSurvey.id,
          type: q.type, label: q.label, description: q.description,
          required: q.required, position: q.position, options: q.options,
        }));
        const { error: qErr } = await (supabase as any)
          .from("training_survey_questions").insert(cloned);
        if (qErr) throw qErr;
      }
      return newSurvey as TrainingSurvey;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: [KEY, "training", s.training_id] });
      qc.invalidateQueries({ queryKey: [KEY, "list", s.training_id] });
      qc.invalidateQueries({ queryKey: [KEY, "questions"] });
    },
  });
};

export const useTrainingSurveyQuestions = (surveyId: string) =>
  useQuery({
    queryKey: [KEY, "questions", surveyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as TrainingSurveyQuestion[];
    },
    enabled: !!surveyId,
  });

export const useTrainingSurveyResponses = (surveyId: string) =>
  useQuery({
    queryKey: [KEY, "responses", surveyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_survey_responses")
        .select("*, training_survey_answers(*)")
        .eq("survey_id", surveyId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingSurveyResponseRow[];
    },
    enabled: !!surveyId,
    staleTime: 0,
  });

export const useTrainingSurveyRecipients = (surveyId: string) =>
  useQuery({
    queryKey: [KEY, "recipients", surveyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_survey_recipients")
        .select("id, email, first_name, last_name, sent_at, last_reminded_at, token")
        .eq("survey_id", surveyId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!surveyId,
  });

export const useUpsertTrainingSurvey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<TrainingSurvey> & { training_id: string },
    ) => {
      const { id, ...rest } = input;
      if (id) {
        const { data, error } = await (supabase as any)
          .from("training_surveys")
          .update(rest)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as TrainingSurvey;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await (supabase as any)
          .from("training_surveys")
          .insert({ ...rest, created_by: user?.id })
          .select()
          .single();
        if (error) throw error;
        return data as TrainingSurvey;
      }
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: [KEY, "training", s.training_id] });
    },
  });
};

export const useUpsertTrainingSurveyQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Partial<TrainingSurveyQuestion> & { survey_id: string }) => {
      if (q.id) {
        const { id, survey_id: _s, created_at: _c, ...updates } = q as TrainingSurveyQuestion;
        const { error } = await (supabase as any)
          .from("training_survey_questions")
          .update(updates)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("training_survey_questions").insert(q);
        if (error) throw error;
      }
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [KEY, "questions", v.survey_id] }),
  });
};

export const useDeleteTrainingSurveyQuestion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, surveyId }: { id: string; surveyId: string }) => {
      const { error } = await (supabase as any)
        .from("training_survey_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return surveyId;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [KEY, "questions", v.surveyId] }),
  });
};

export const useReorderTrainingSurveyQuestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ surveyId, ordered }: { surveyId: string; ordered: { id: string; position: number }[] }) => {
      await Promise.all(
        ordered.map(({ id, position }) =>
          (supabase as any).from("training_survey_questions").update({ position }).eq("id", id),
        ),
      );
      return surveyId;
    },
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [KEY, "questions", v.surveyId] }),
  });
};

export const useSendTrainingSurvey = () =>
  useMutation({
    mutationFn: async (input: string | { surveyId: string; includeTrainer?: boolean }) => {
      const body = typeof input === "string" ? { surveyId: input } : input;
      const { data, error } = await supabase.functions.invoke("send-training-survey", { body });
      if (error) throw error;
      return data as { success: boolean; sent: number; failed: number };
    },
  });

