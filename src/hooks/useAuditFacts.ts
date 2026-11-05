import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildFacts, type AuditFacts } from "@/lib/auditChecks";

/**
 * Collecte des faits de l'audit blanc.
 *
 * Tout ce qui est mesurable est mesuré ici, sur les données réelles. Rien n'est
 * estimé, rien n'est déduit d'un autre chiffre : un contrôle qui ne peut pas
 * s'appuyer sur une donnée devient une question posée à l'auditeur, pas une
 * valeur inventée.
 *
 * L'échantillon suit la conduite d'audit du guide : l'auditeur procède par
 * échantillonnage d'actions. On tire les sessions terminées les plus récentes,
 * celles dont les preuves doivent exister.
 */

const SAMPLE_SIZE = 5;
const SUBMITTED_SURVEY_STATES = ["complete", "valide_formateur"];

export interface AuditSample {
  trainingId: string;
  trainingName: string;
  endDate: string | null;
}

export interface AuditFactsResult {
  facts: AuditFacts;
  sample: AuditSample[];
}

const count = (rows: { length: number } | null | undefined) => rows?.length ?? 0;

export function useAuditFacts() {
  const [loading, setLoading] = useState(false);

  const gather = useCallback(async (): Promise<AuditFactsResult> => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

      // Échantillon : sessions terminées les plus récentes.
      const { data: finished } = await supabase
        .from("trainings")
        .select("id, training_name, start_date, end_date, objectives, program_file_url, supports_lms_course_id, trainer_id")
        .not("start_date", "is", null)
        .lte("start_date", today)
        .order("start_date", { ascending: false })
        .limit(SAMPLE_SIZE);

      const sampleRows = finished ?? [];
      const sampleIds = sampleRows.map((t) => t.id);
      const sample: AuditSample[] = sampleRows.map((t) => ({
        trainingId: t.id,
        trainingName: t.training_name,
        endDate: t.end_date ?? t.start_date,
      }));

      const [
        formations,
        evaluations,
        surveys,
        participants,
        adequacy,
        reglement,
        vhd,
        courses,
        lessons,
        trainers,
        trainerDocs,
        watchItems,
        watchSources,
        referentName,
        referentEmail,
        partners,
        coldParticipant,
        coldSponsor,
        funder,
        reclamations,
        risks,
        improvements,
      ] = await Promise.all([
        supabase.from("formation_configs").select("id, recognition_type, funding_terms, access_delay, accessibility_terms").eq("is_active", true),
        sampleIds.length
          ? supabase.from("training_evaluations").select("training_id, etat").in("training_id", sampleIds).eq("etat", "soumis")
          : Promise.resolve({ data: [] as { training_id: string }[] }),
        sampleIds.length
          ? supabase.from("questionnaire_besoins").select("training_id, prerequis_validation, etat").in("training_id", sampleIds).in("etat", SUBMITTED_SURVEY_STATES)
          : Promise.resolve({ data: [] as { training_id: string; prerequis_validation: string | null }[] }),
        sampleIds.length
          ? supabase.from("training_participants").select("training_id, needs_survey_sent_at").in("training_id", sampleIds)
          : Promise.resolve({ data: [] as { training_id: string; needs_survey_sent_at: string | null }[] }),
        sampleIds.length
          ? supabase.from("trainer_training_adequacy").select("training_id").in("training_id", sampleIds)
          : Promise.resolve({ data: [] as { training_id: string }[] }),
        supabase.rpc("get_app_setting_public", { p_key: "reglement_interieur_url" }),
        supabase.from("vhd_procedures").select("id, status").eq("status", "active"),
        supabase.from("lms_courses").select("id"),
        supabase.from("lms_lessons").select("id, module_id, is_mandatory"),
        supabase.from("trainers").select("id, competences, formations_suivies"),
        supabase.from("trainer_documents").select("trainer_id"),
        supabase.from("watch_items").select("id").gte("created_at", oneYearAgo),
        supabase.from("watch_sources").select("id").eq("status", "followed"),
        supabase.rpc("get_app_setting_public", { p_key: "referent_handicap_name" }),
        supabase.rpc("get_app_setting_public", { p_key: "referent_handicap_email" }),
        supabase.from("handicap_partners").select("id").eq("is_active", true),
        supabase.from("participant_cold_evaluations").select("id").eq("etat", "soumis"),
        supabase.from("sponsor_cold_evaluations").select("id").eq("etat", "soumis"),
        supabase.from("trainings").select("id").not("funder_appreciation", "is", null),
        supabase.from("reclamations").select("id, status, acknowledgement_sent_at, response_date").neq("status", "draft"),
        supabase.from("quality_risks").select("id, criticality, preventive_measure, status"),
        supabase.from("improvements").select("id"),
      ]);

      const lessonRows = lessons.data ?? [];
      const facts = buildFacts({
        sampleIds,
        sampleTrainings: sampleRows,
        activeFormations: formations.data ?? [],
        submittedEvaluations: evaluations.data ?? [],
        submittedSurveys: surveys.data ?? [],
        participants: participants.data ?? [],
        adequacy: adequacy.data ?? [],
        reglementUrl: (reglement.data as string | null) ?? null,
        activeVhdProcedures: count(vhd.data),
        lmsCourses: count(courses.data),
        mandatoryLessons: lessonRows.filter((l) => l.is_mandatory !== false).length,
        trainers: trainers.data ?? [],
        trainerDocumentOwners: (trainerDocs.data ?? []).map((d) => d.trainer_id),
        watchItemsLastYear: count(watchItems.data),
        watchSourcesFollowed: count(watchSources.data),
        // Aucun rattachement entre un élément de veille et une décision
        // n'existe encore dans le schéma.
        watchItemsLinkedToAction: 0,
        referentName: (referentName.data as string | null) ?? null,
        referentEmail: (referentEmail.data as string | null) ?? null,
        handicapPartnersActive: count(partners.data),
        coldEvaluationsSubmitted: count(coldParticipant.data),
        sponsorEvaluationsSubmitted: count(coldSponsor.data),
        funderAppreciations: count(funder.data),
        reclamations: reclamations.data ?? [],
        risks: risks.data ?? [],
        improvements: count(improvements.data),
      });

      return { facts, sample };
    } finally {
      setLoading(false);
    }
  }, []);

  return { gather, loading };
}
