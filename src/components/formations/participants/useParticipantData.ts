import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type EvaluationInfo,
  type CertificateInfo as CertInfo,
  buildEvaluationMaps,
} from "@/lib/evaluationUtils";
import type { Participant, ConventionSignatureInfo } from "./types";

interface UseParticipantDataResult {
  certificatesByParticipant: Map<string, CertInfo>;
  evaluationsByParticipant: Map<string, EvaluationInfo>;
  participantsWithSignatures: Set<string>;
  conventionSignatures: Map<string, ConventionSignatureInfo>;
}

export function useParticipantData(
  trainingId: string,
  participants: Participant[],
  isIndividualConvention: boolean,
): UseParticipantDataResult {
  const [certificatesByParticipant, setCertificatesByParticipant] = useState<Map<string, CertInfo>>(new Map());
  const [evaluationsByParticipant, setEvaluationsByParticipant] = useState<Map<string, EvaluationInfo>>(new Map());
  const [participantsWithSignatures, setParticipantsWithSignatures] = useState<Set<string>>(new Set());
  const [conventionSignatures, setConventionSignatures] = useState<Map<string, ConventionSignatureInfo>>(new Map());

  // Fetch all evaluations (certificates + status) for all participants
  useEffect(() => {
    const fetchEvaluations = async () => {
      const { data, error } = await (supabase as ReturnType<typeof supabase.from>)
        .from("training_evaluations")
        .select(`
          id, participant_id, certificate_url, etat, date_soumission,
          first_name, last_name, company, email,
          appreciation_generale, recommandation, message_recommandation,
          objectifs_evaluation, objectif_prioritaire, delai_application,
          freins_application, rythme, equilibre_theorie_pratique,
          amelioration_suggeree, conditions_info_satisfaisantes,
          formation_adaptee_public, qualification_intervenant_adequate,
          appreciations_prises_en_compte, consent_publication, remarques_libres
        `)
        .eq("training_id", trainingId);

      if (!error && data) {
        const { certificateMap, evaluationMap } = buildEvaluationMaps(data);
        setCertificatesByParticipant(certificateMap);
        setEvaluationsByParticipant(evaluationMap);
      }
    };
    fetchEvaluations();
  }, [trainingId, participants]);

  // Fetch attendance signatures to block deletion for participants who signed
  useEffect(() => {
    const fetchAttendanceSignatures = async () => {
      const { data, error } = await (supabase as ReturnType<typeof supabase.from>)
        .from("attendance_signatures")
        .select("participant_id")
        .eq("training_id", trainingId)
        .not("signed_at", "is", null);

      if (!error && data) {
        const ids = new Set<string>(data.map((r: { participant_id: string }) => r.participant_id));
        setParticipantsWithSignatures(ids);
      }
    };
    fetchAttendanceSignatures();
  }, [trainingId, participants]);

  // Fetch convention signature statuses for inter/e-learning participants
  useEffect(() => {
    if (!isIndividualConvention) return;

    const fetchConventionSignatures = async () => {
      const sponsorEmails = participants
        .filter(p => p.sponsor_email)
        .map(p => p.sponsor_email!);

      if (sponsorEmails.length === 0) return;

      const { data, error } = await (supabase as ReturnType<typeof supabase.from>)
        .from("convention_signatures")
        .select("recipient_email, status, signed_at")
        .eq("training_id", trainingId)
        .in("recipient_email", sponsorEmails);

      if (!error && data) {
        const map = new Map<string, ConventionSignatureInfo>();
        for (const sig of data as { recipient_email: string; status: string; signed_at: string | null }[]) {
          for (const p of participants) {
            if (p.sponsor_email === sig.recipient_email) {
              map.set(p.id, {
                status: sig.status,
                signed_at: sig.signed_at,
              });
            }
          }
        }
        setConventionSignatures(map);
      }
    };
    fetchConventionSignatures();
  }, [trainingId, participants, isIndividualConvention]);

  return {
    certificatesByParticipant,
    evaluationsByParticipant,
    participantsWithSignatures,
    conventionSignatures,
  };
}
