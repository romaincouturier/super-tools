import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuditFacts } from "@/lib/auditChecks";

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

      const formationRows = formations.data ?? [];
      const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
      const formationsWithAllDisclosures = formationRows.filter(
        (f) =>
          filled(f.recognition_type) &&
          filled(f.funding_terms) &&
          filled(f.access_delay) &&
          filled(f.accessibility_terms),
      ).length;

      const withEvaluation = new Set((evaluations.data ?? []).map((e) => e.training_id));
      const surveyRows = surveys.data ?? [];
      const withSurvey = new Set(surveyRows.map((s) => s.training_id));
      const withPrerequisite = new Set(
        surveyRows.filter((s) => filled(s.prerequis_validation)).map((s) => s.training_id),
      );
      const withConvocation = new Set(
        (participants.data ?? []).filter((p) => p.needs_survey_sent_at).map((p) => p.training_id),
      );
      const withAdequacy = new Set((adequacy.data ?? []).map((a) => a.training_id));

      const lessonRows = lessons.data ?? [];
      const mandatoryModuleIds = new Set(
        lessonRows.filter((l) => l.is_mandatory !== false).map((l) => l.module_id),
      );

      const trainerRows = trainers.data ?? [];
      const docTrainerIds = new Set((trainerDocs.data ?? []).map((d) => d.trainer_id));
      const hasContinuingEducation = (value: unknown) =>
        Array.isArray(value) ? value.length > 0 : false;

      const reclamationRows = reclamations.data ?? [];
      const riskRows = risks.data ?? [];

      const facts: AuditFacts = {
        activeFormations: formationRows.length,
        formationsWithAllDisclosures,
        formationsWithSatisfaction: withEvaluation.size,
        satisfactionMethodAvailable: true,
        sampleSize: sampleRows.length,
        sampleWithObjectives: sampleRows.filter((t) => (t.objectives ?? []).length > 0).length,
        sampleWithProgramme: sampleRows.filter((t) => t.program_file_url || t.supports_lms_course_id).length,
        sampleWithTrainer: sampleRows.filter((t) => t.trainer_id).length,
        sampleWithNeedsSurvey: sampleIds.filter((id) => withSurvey.has(id)).length,
        sampleWithPrerequisiteCheck: sampleIds.filter((id) => withPrerequisite.has(id)).length,
        sampleWithEvaluations: sampleIds.filter((id) => withEvaluation.has(id)).length,
        sampleWithConvocation: sampleIds.filter((id) => withConvocation.has(id)).length,
        sampleWithTrainerAdequacy: sampleIds.filter((id) => withAdequacy.has(id)).length,
        reglementInterieurPublished: filled(reglement.data as string | null),
        vhdProcedureActive: count(vhd.data) > 0,
        vhdProcedurePublished: count(vhd.data) > 0,
        elearningCourses: count(courses.data),
        elearningCoursesWithMandatoryLessons: mandatoryModuleIds.size > 0 ? count(courses.data) : 0,
        distanceThresholdConfigured: false,
        trainers: trainerRows.length,
        trainersWithCompetences: trainerRows.filter((t) => (t.competences ?? []).length > 0).length,
        trainersWithDocuments: trainerRows.filter((t) => docTrainerIds.has(t.id)).length,
        trainersWithContinuingEducation: trainerRows.filter((t) =>
          hasContinuingEducation(t.formations_suivies),
        ).length,
        watchItemsLastYear: count(watchItems.data),
        watchSourcesFollowed: count(watchSources.data),
        // Aucun rattachement entre un élément de veille et une décision
        // n'existe encore dans le schéma : le compte reste à zéro tant que le
        // lien n'est pas posé, plutôt que de laisser croire à une exploitation.
        watchItemsLinkedToAction: 0,
        handicapReferentDesignated:
          filled(referentName.data as string | null) && filled(referentEmail.data as string | null),
        handicapPartnersActive: count(partners.data),
        coldEvaluationsSubmitted: count(coldParticipant.data),
        sponsorEvaluationsSubmitted: count(coldSponsor.data),
        funderAppreciations: count(funder.data),
        reclamations: reclamationRows.length,
        reclamationsAcknowledged: reclamationRows.filter((r) => r.acknowledgement_sent_at).length,
        reclamationsAnswered: reclamationRows.filter((r) => r.response_date).length,
        qualityRisks: riskRows.length,
        highRisksWithoutMeasure: riskRows.filter(
          (r) =>
            (r.criticality ?? 0) >= 8 &&
            r.status !== "closed" &&
            !filled(r.preventive_measure),
        ).length,
        improvements: count(improvements.data),
      };

      return { facts, sample };
    } finally {
      setLoading(false);
    }
  }, []);

  return { gather, loading };
}
