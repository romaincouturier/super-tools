import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ParticipantTraining {
  training_id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  added_at: string;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  elearning_duration: number | null;
  convention_file_url: string | null;
  signed_convention_url: string | null;
  invoice_file_url: string | null;
}

export interface ParticipantEvaluation {
  training_id: string;
  training_name: string;
  appreciation_generale: number | null;
  commentaire_general: string | null;
  date_soumission: string | null;
  certificate_url: string | null;
}

export interface ParticipantHistory {
  email: string;
  name: string;
  company: string | null;
  trainings: ParticipantTraining[];
  evaluations: ParticipantEvaluation[];
}

export function useParticipantHistory() {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ParticipantHistory | null>(null);

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setHistory(null);
      return;
    }

    setLoading(true);
    try {
      // Search participants by email or name
      const isEmail = trimmed.includes("@");
      let participantQuery = supabase
        .from("training_participants")
        .select("*, trainings(id, training_name, start_date, end_date)")
        .order("added_at", { ascending: false });

      if (isEmail) {
        participantQuery = participantQuery.ilike("email", `%${trimmed}%`);
      } else {
        // Search by name (first or last)
        participantQuery = participantQuery.or(
          `first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`
        );
      }

      const { data: participants } = await participantQuery;

      if (!participants || participants.length === 0) {
        setHistory(null);
        setLoading(false);
        return;
      }

      // Get the first match's email to aggregate
      const email = participants[0].email;
      const name = [participants[0].first_name, participants[0].last_name].filter(Boolean).join(" ") || email;
      const company = participants[0].company;

      // Get all participations for this email
      const { data: allParticipations } = await supabase
        .from("training_participants")
        .select("*, trainings(id, training_name, start_date, end_date)")
        .eq("email", email)
        .order("added_at", { ascending: false });

      const trainings: ParticipantTraining[] = (allParticipations || []).map((p: any) => ({
        training_id: p.trainings?.id || p.training_id,
        training_name: p.trainings?.training_name || "—",
        start_date: p.trainings?.start_date || null,
        end_date: p.trainings?.end_date || null,
        first_name: p.first_name,
        last_name: p.last_name,
        company: p.company,
        added_at: p.added_at,
        needs_survey_status: p.needs_survey_status,
        needs_survey_sent_at: p.needs_survey_sent_at,
        elearning_duration: p.elearning_duration,
        convention_file_url: p.convention_file_url,
        signed_convention_url: p.signed_convention_url,
        invoice_file_url: p.invoice_file_url,
      }));

      // Fetch evaluations for this email across all trainings
      const trainingIds = trainings.map((t) => t.training_id).filter(Boolean);
      let evaluations: ParticipantEvaluation[] = [];

      if (trainingIds.length > 0) {
        const { data: evalData } = await (supabase as any)
          .from("training_evaluations")
          .select("*, trainings(training_name)")
          .eq("email", email)
          .in("training_id", trainingIds);

        evaluations = (evalData || []).map((e: any) => ({
          training_id: e.training_id,
          training_name: e.trainings?.training_name || "—",
          appreciation_generale: e.appreciation_generale,
          commentaire_general: e.commentaire_general,
          date_soumission: e.date_soumission,
          certificate_url: e.certificate_url,
        }));
      }

      setHistory({ email, name, company, trainings, evaluations });
    } catch (error) {
      console.error("Error searching participant:", error);
      setHistory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { search, loading, history };
}
