import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { isCronOrServiceRole } from "../_shared/cron-auth.ts";
import { buildFacts, automaticIssues, type RawAuditData } from "../_shared/qualiopi-checks.ts";

/**
 * Audit blanc automatique, chaque nuit.
 *
 * La tâche ne rend pas de verdict complet : un audit ne conclut pas sur ce
 * qu'il n'a pas regardé, et les questions posées à l'auditeur n'ont pas de
 * réponse ici. Elle fait ce qu'une machine peut faire seule : repasser les
 * contrôles sur les données, figer les faits du jour, et inscrire chaque
 * constat en défaut dans les actions quotidiennes.
 *
 * L'index unique de daily_actions porte sur (user, date, catégorie, entité) :
 * rejouer la tâche le même jour ne duplique donc aucune action, et un constat
 * corrigé cesse d'apparaître le lendemain.
 */

const VERSION = "run-qualiopi-audit@2026-11-05.1";
const SAMPLE_SIZE = 5;
const SUBMITTED_SURVEY_STATES = ["complete", "valide_formateur"];

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Règle [036] : secret dédié au domaine, jamais le vault, qui est vide
    // sur ce projet. Le cron est planifié en base avec ce secret inline.
    if (!(await isCronOrServiceRole(req, "QUALIOPI_CRON_SECRET"))) {
      return createErrorResponse("Unauthorized", 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

    const { data: sampleTrainings, error: sampleError } = await supabase
      .from("trainings")
      .select("id, objectives, program_file_url, supports_lms_course_id, trainer_id")
      .not("start_date", "is", null)
      .lte("start_date", today)
      .order("start_date", { ascending: false })
      .limit(SAMPLE_SIZE);

    // Un échantillon vide par échec de lecture court-circuiterait cinq
    // requêtes vers des tableaux sans clé d'erreur : le garde plus bas ne
    // verrait rien et la nuit se conclurait sur un audit propre.
    if (sampleError) {
      return createErrorResponse(`Lecture des sessions impossible : ${sampleError.message}`, 500);
    }

    const sample = sampleTrainings ?? [];
    const sampleIds = sample.map((t) => t.id);
    const scoped = <T>(q: Promise<{ data: T[] | null }>, fallback: T[] = []) =>
      sampleIds.length ? q : Promise.resolve({ data: fallback });

    const [
      formations, evaluations, surveys, participants, adequacy, reglement, vhd,
      courses, modules, lessons, trainers, trainerDocs, watchItems, watchSources,
      referentName, referentEmail, partners, coldParticipant, coldSponsor,
      funder, reclamations, risks, improvements,
    ] = await Promise.all([
      supabase.from("formation_configs").select("recognition_type, funding_terms, access_delay, accessibility_terms").eq("is_active", true),
      scoped(supabase.from("training_evaluations").select("training_id").in("training_id", sampleIds).eq("etat", "soumis")),
      scoped(supabase.from("questionnaire_besoins").select("training_id, prerequis_validation").in("training_id", sampleIds).in("etat", SUBMITTED_SURVEY_STATES)),
      scoped(supabase.from("training_participants").select("training_id, needs_survey_sent_at").in("training_id", sampleIds)),
      scoped(supabase.from("trainer_training_adequacy").select("training_id").in("training_id", sampleIds)),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "reglement_interieur_url").maybeSingle(),
      supabase.from("vhd_procedures").select("id").eq("status", "active"),
      supabase.from("lms_courses").select("id"),
      supabase.from("lms_modules").select("id, course_id"),
      supabase.from("lms_lessons").select("module_id, is_mandatory"),
      supabase.from("trainers").select("id, competences, formations_suivies"),
      supabase.from("trainer_documents").select("trainer_id"),
      supabase.from("watch_items").select("id").gte("created_at", oneYearAgo),
      supabase.from("watch_sources").select("id").eq("status", "followed"),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "referent_handicap_name").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "referent_handicap_email").maybeSingle(),
      supabase.from("handicap_partners").select("id").eq("is_active", true),
      supabase.from("participant_cold_evaluations").select("id").eq("etat", "soumis"),
      supabase.from("sponsor_cold_evaluations").select("id").eq("etat", "soumis"),
      supabase.from("trainings").select("id").not("funder_appreciation", "is", null),
      supabase.from("reclamations").select("acknowledgement_sent_at, response_date").neq("status", "draft"),
      supabase.from("quality_risks").select("criticality, preventive_measure, status"),
      supabase.from("improvements").select("id"),
    ]);

    // Une lecture en échec deviendrait un zéro mesuré, donc un constat en
    // défaut inventé, inscrit le lendemain dans les actions de tout le monde.
    const reads: Array<[string, { error?: unknown }]> = [
      ["formation_configs", formations], ["training_evaluations", evaluations],
      ["questionnaire_besoins", surveys], ["training_participants", participants],
      ["trainer_training_adequacy", adequacy], ["app_settings", reglement],
      ["vhd_procedures", vhd], ["lms_courses", courses], ["lms_modules", modules],
      ["lms_lessons", lessons], ["trainers", trainers], ["trainer_documents", trainerDocs],
      ["watch_items", watchItems], ["watch_sources", watchSources],
      ["handicap_partners", partners], ["participant_cold_evaluations", coldParticipant],
      ["sponsor_cold_evaluations", coldSponsor], ["trainings", funder],
      ["reclamations", reclamations], ["quality_risks", risks], ["improvements", improvements],
    ];
    const failed = reads.filter(([, r]) => r.error).map(([t]) => t);
    if (failed.length > 0) {
      return createErrorResponse(`Lectures en échec : ${failed.join(", ")}`, 500);
    }

    const len = (d: unknown[] | null | undefined) => d?.length ?? 0;
    const raw: RawAuditData = {
      sampleIds,
      sampleTrainings: sample,
      activeFormations: formations.data ?? [],
      submittedEvaluations: evaluations.data ?? [],
      submittedSurveys: surveys.data ?? [],
      participants: participants.data ?? [],
      adequacy: adequacy.data ?? [],
      reglementUrl: reglement.data?.setting_value ?? null,
      activeVhdProcedures: len(vhd.data),
      lmsCourseIds: (courses.data ?? []).map((c) => c.id),
      lmsModules: modules.data ?? [],
      lmsLessons: lessons.data ?? [],
      trainers: trainers.data ?? [],
      trainerDocumentOwners: (trainerDocs.data ?? []).map((d) => d.trainer_id),
      watchItemsLastYear: len(watchItems.data),
      watchSourcesFollowed: len(watchSources.data),
      watchItemsLinkedToAction: 0,
      referentName: referentName.data?.setting_value ?? null,
      referentEmail: referentEmail.data?.setting_value ?? null,
      handicapPartnersActive: len(partners.data),
      coldEvaluationsSubmitted: len(coldParticipant.data),
      sponsorEvaluationsSubmitted: len(coldSponsor.data),
      funderAppreciations: len(funder.data),
      reclamations: reclamations.data ?? [],
      risks: risks.data ?? [],
      improvements: len(improvements.data),
    };

    const facts = buildFacts(raw);
    const issues = automaticIssues(facts);

    const { error: runError } = await supabase.from("audit_runs").insert({
      label: `Contrôle automatique du ${new Date().toLocaleDateString("fr-FR")}`,
      finished_at: new Date().toISOString(),
      sample_training_ids: sampleIds,
      facts,
      answers: {},
      findings: issues,
      notes: "Passage automatique : contrôles sur les données seulement, sans les questions à l'auditeur.",
    });

    // La trace du passage est la preuve attendue au titre de l'audit interne :
    // la perdre en silence viderait la tâche de son objet.
    if (runError) {
      return createErrorResponse(`Enregistrement du passage impossible : ${runError.message}`, 500);
    }

    // Les constats partent chez les administrateurs : ce sont eux qui portent
    // la conformité, et la table est lue par utilisateur.
    // daily_actions.user_id référence auth.users(id), que profiles porte dans
    // user_id et non dans id : les deux colonnes diffèrent sur chaque ligne.
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_admin", true);
    if (adminsError) throw adminsError;
    const recipients = (admins ?? []).map((a) => a.user_id).filter(Boolean) as string[];

    const rows = recipients.flatMap((userId) =>
      issues.map((issue) => ({
        user_id: userId,
        action_date: today,
        category: "qualiopi",
        title: `Indicateur ${issue.indicator} : ${issue.label}`,
        description: `${issue.detail}. ${
          issue.kind === "sans_matiere"
            ? "Le contrôle n'a rien trouvé à vérifier : il ne peut pas conclure en l'état."
            : issue.gradation === "majeure_seule"
              ? "Cet indicateur ne connaît que la non-conformité majeure."
              : "Non-conformité mineure possible."
        }`,
        link: issue.fixHref ?? "/audit-blanc",
        entity_type: "qualiopi_check",
        entity_id: issue.checkId,
      })),
    );

    if (rows.length > 0) {
      const { error } = await supabase
        .from("daily_actions")
        // Pas d'ignoreDuplicates : un second passage le même jour doit
        // rafraîchir le compte affiché. is_completed n'est pas dans la charge
        // utile, donc une action déjà cochée le reste.
        .upsert(rows, { onConflict: "user_id,action_date,category,entity_type,entity_id" });
      if (error) console.error(`[${VERSION}] insertion des actions`, error);
    }

    console.log(`[${VERSION}] ${issues.length} constats, ${rows.length} actions`);

    return new Response(
      JSON.stringify({ success: true, issues: issues.length, actions: rows.length, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(`[${VERSION}]`, error);
    return createErrorResponse(error instanceof Error ? error.message : "Audit failed", 500);
  }
});
