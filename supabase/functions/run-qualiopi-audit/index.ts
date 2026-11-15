import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { hasManagedCronCredential, isCronOrServiceRole } from "../_shared/cron-auth.ts";
import { buildFacts, automaticIssues, type RawAuditData } from "../_shared/qualiopi-checks.ts";
import { auditChanges, auditMailSummary, escapeAuditHtml } from '../_shared/qualiopi-summary.ts';
import { sendEmail } from '../_shared/resend.ts';
import { getBccList } from '../_shared/email-settings.ts';
import { getSigniticSignature } from '../_shared/signitic.ts';

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
    // Planification gérée Lovable Cloud (LOVABLE_CRON_SECRET), ou secret dédié
    // QUALIOPI_CRON_SECRET (règle [036]) pour un appel manuel interne.
    const authorized = (await hasManagedCronCredential(req)) ||
      (await isCronOrServiceRole(req, "QUALIOPI_CRON_SECRET"));
    if (!authorized) {
      return createErrorResponse("Unauthorized", 401);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Configuration serveur absente');
    const supabase = createClient(url, key);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
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

    const previousRead = await supabase.from('audit_runs').select('findings, facts, summary_email_sent_at')
      .like('notes', 'Passage automatique%').order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (previousRead.error) throw previousRead.error;
    const sentRead = await supabase.from('audit_runs').select('id').not('summary_email_sent_at', 'is', null).limit(1);
    if (sentRead.error) throw sentRead.error;
    const { data: run, error: runError } = await supabase.from("audit_runs").insert({
      label: `Contrôle automatique du ${new Date().toLocaleDateString("fr-FR", { timeZone: 'Europe/Paris' })}`,
      finished_at: new Date().toISOString(),
      sample_training_ids: sampleIds,
      facts,
      answers: {},
      findings: issues,
      notes: "Passage automatique : contrôles sur les données seulement, sans les questions à l'auditeur.",
    }).select('id').single();

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

    const owner = await supabase.from('profiles').select('user_id').eq('email', 'romain@supertilt.fr').maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.user_id) recipients.push(owner.data.user_id);
    for (const userId of new Set(recipients)) {
      const synced = await supabase.rpc('sync_daily_quality_actions', { _user_id: userId });
      if (synced.error) throw synced.error;
    }

    const delta = auditChanges(issues, previousRead.data?.findings ?? []);
    const summary = auditMailSummary(facts);
    const previousSummary = previousRead.data?.facts ? auditMailSummary(previousRead.data.facts) : null;
    const summaryChanged = JSON.stringify(summary) !== JSON.stringify(previousSummary);
    let emailSent = false;
    if (delta.changed || summaryChanged || !sentRead.data?.length) {
      const list = (items: string[]) => items.length ? `<ul>${items.map(i => `<li>${escapeAuditHtml(i)}</li>`).join('')}</ul>` : '<p>Aucun.</p>';
      const html = `<div style="text-align:left"><h1>Audit blanc Qualiopi</h1><p>${summary.conforme} indicateurs conformes ; ${summary.aVerifier} à vérifier / à risque ; ${summary.mineure + summary.majeure} non conformes (${summary.mineure} mineurs, ${summary.majeure} majeurs).</p><p>Contrôle automatique : les questions sans réponse empêchent de conclure à la conformité.</p><h2>Nouveaux écarts (${delta.added.length})</h2>${list(delta.added.map(i => `Indicateur ${i.indicator} : ${i.label} — ${i.detail}`))}<h2>Écarts résolus (${delta.resolved.length})</h2>${list(delta.resolved.map(i => `Indicateur ${i.indicator} : ${i.label}`))}<h2>Écarts mis à jour (${delta.updated.length})</h2>${list(delta.updated.map(i => `Indicateur ${i.indicator} : ${i.label} — ${i.detail}`))}<h2>Questions ouvertes à l'auditeur (${summary.questions.length})</h2>${list(summary.questions)}<p><a href="https://academy.supertilt.fr/audit-blanc">Ouvrir l'audit blanc</a></p>${await getSigniticSignature()}</div>`;
      const sent = await sendEmail({ to: 'romain@supertilt.fr', bcc: (await getBccList()).filter(e => e !== 'romain@supertilt.fr'), subject: `Audit blanc : ${issues.length} écarts, ${delta.added.length} nouveaux, ${delta.resolved.length} résolus`, html, _emailType: 'qualiopi_audit_summary', idempotencyKey: `qualiopi-audit-${run.id}` });
      const saved = await supabase.from('audit_runs').update({ summary_email_sent_at: sent.success ? new Date().toISOString() : null, summary_email_error: sent.error ?? null }).eq('id', run.id);
      if (saved.error) throw saved.error;
      if (!sent.success) throw new Error(`Envoi du bilan impossible : ${sent.error}`);
      emailSent = true;
    }
    console.log(`[${VERSION}] ${issues.length} constats, bilan envoyé : ${emailSent}`);

    return new Response(
      JSON.stringify({ success: true, issues: issues.length, actions: issues.length * new Set(recipients).size, emailSent, summary, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(`[${VERSION}]`, error);
    return createErrorResponse(error instanceof Error ? error.message : "Audit failed", 500);
  }
});
