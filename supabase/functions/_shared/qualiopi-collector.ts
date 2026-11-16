import { buildFacts, type RawAuditData } from './qualiopi-checks.ts';

export async function collectAuditFacts(db: any, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const yearAgo = new Date(now.getTime() - 365 * 86400000).toISOString();
  const read = async (query: any, label: string) => {
    const result = await query;
    if (result.error) throw new Error(`Lecture ${label} impossible : ${result.error.message}`);
    return result.data ?? [];
  };
  const all = async (makeQuery: () => any, label: string) => {
    const rows: any[] = [];
    for (let start = 0; ; start += 500) {
      const page = await read(makeQuery().order('id').range(start, start + 499), label);
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  };
  const count = async (query: any, label: string) => {
    const result = await query;
    if (result.error || result.count === null) throw new Error(`Comptage ${label} impossible : ${result.error?.message ?? 'total absent'}`);
    return result.count;
  };
  const sample = await read(db.from('trainings').select('id, training_name, start_date, end_date, objectives, prerequisites, program_file_url, supports_lms_course_id, trainer_id')
    .eq('is_cancelled', false).lt('end_date', today).order('end_date', { ascending: false }).order('id').limit(5), 'sessions terminées');
  const ids = sample.map((t: any) => t.id);
  const scoped = (table: string, columns: string, filter?: (q: any) => any) => ids.length
    ? all(() => { const q = db.from(table).select(columns).in('training_id', ids); return filter ? filter(q) : q; }, table)
    : Promise.resolve([]);
  const [formations, evaluations, surveys, invitations, adequacy, settings, vhd, courses, modules, lessons, trainers, documents, watchCount, sourcesCount,
    partners, cold, sponsors, funder, complaints, risks, improvements, trainerReturns, reminders, solicitations] = await Promise.all([
    all(() => db.from('formation_configs').select('id, formation_name, recognition_type, funding_terms, access_delay, accessibility_terms').eq('is_active', true), 'catalogue'),
    scoped('training_evaluations', 'id, training_id, objectifs_evaluation', q => q.eq('etat', 'soumis')),
    scoped('questionnaire_besoins', 'id, training_id, prerequis_validation, niveau_actuel, competences_actuelles', q => q.in('etat', ['complete', 'valide_formateur'])),
    scoped('sent_emails_log', 'id, training_id', q => q.in('email_type', ['welcome', 'scheduled_welcome', 'needs_survey', 'scheduled_needs_survey'])),
    scoped('trainer_training_adequacy', 'id, training_id', q => q.not('validated_at', 'is', null).not('validated_by', 'is', null)),
    read(db.from('app_settings').select('setting_key, setting_value').in('setting_key', ['reglement_interieur_url', 'referent_handicap_name', 'referent_handicap_email']), 'réglages'),
    count(db.from('vhd_procedures').select('id', { count: 'exact', head: true }).eq('status', 'active'), 'procédure'),
    all(() => db.from('lms_courses').select('id').eq('status', 'published'), 'cours publiés'),
    all(() => db.from('lms_modules').select('id, course_id'), 'modules'),
    all(() => db.from('lms_lessons').select('id, module_id, is_mandatory'), 'leçons'),
    all(() => db.from('trainers').select('id, first_name, last_name, competences, formations_suivies, cv_url'), 'formateurs'),
    all(() => db.from('trainer_documents').select('id, trainer_id'), 'justificatifs'),
    count(db.from('watch_items').select('id', { count: 'exact', head: true }).gte('created_at', yearAgo), 'veille'),
    count(db.from('watch_sources').select('id', { count: 'exact', head: true }).eq('status', 'followed'), 'sources suivies'),
    count(db.from('handicap_partners').select('id', { count: 'exact', head: true }).eq('is_active', true), 'partenaires handicap'),
    count(db.from('participant_cold_evaluations').select('id', { count: 'exact', head: true }).eq('etat', 'soumis'), 'retours participants'),
    count(db.from('sponsor_cold_evaluations').select('id', { count: 'exact', head: true }).eq('etat', 'soumis'), 'retours commanditaires'),
    count(db.from('trainings').select('id', { count: 'exact', head: true }).not('funder_appreciation', 'is', null), 'appréciations financeurs'),
    all(() => db.from('reclamations').select('id, acknowledgement_sent_at, response_date').neq('status', 'draft'), 'réclamations'),
    all(() => db.from('quality_risks').select('id, criticality, preventive_measure, status'), 'risques'),
    all(() => db.from('improvements').select('id, source_type, source_id, source_description, source_analysis_id'), 'améliorations'),
    count(db.from('trainer_evaluations').select('id', { count: 'exact', head: true }).eq('status', 'soumis'), 'retours formateurs'),
    count(db.from('sent_emails_log').select('id', { count: 'exact', head: true }).eq('email_type', 'elearning_start_reminder').gte('sent_at', yearAgo), 'relances de démarrage'),
    count(db.from('sent_emails_log').select('id', { count: 'exact', head: true }).in('email_type', ['scheduled_cold_evaluation', 'funder_reminder']).gte('sent_at', yearAgo), 'sollicitations parties prenantes'),
  ]);
  const setting = (key: string) => settings.find((s: any) => s.setting_key === key)?.setting_value ?? null;
  const raw: RawAuditData = {
    sampleIds: ids, sampleTrainings: sample, activeFormations: formations, submittedEvaluations: evaluations, submittedSurveys: surveys,
    participants: [], invitationTrainingIds: invitations.map((e: any) => e.training_id), adequacy,
    reglementUrl: setting('reglement_interieur_url'), activeVhdProcedures: vhd,
    lmsCourseIds: courses.map((c: any) => c.id), lmsModules: modules, lmsLessons: lessons, trainers,
    trainerDocumentOwners: documents.map((d: any) => d.trainer_id), watchItemsLastYear: watchCount, watchSourcesFollowed: sourcesCount,
    watchItemsLinkedToAction: new Set(improvements.filter((i: any) => ['watch', 'veille', 'watch_item'].includes(i.source_type) && i.source_id).map((i: any) => i.source_id)).size,
    referentName: setting('referent_handicap_name'), referentEmail: setting('referent_handicap_email'), handicapPartnersActive: partners,
    coldEvaluationsSubmitted: cold, sponsorEvaluationsSubmitted: sponsors, funderAppreciations: funder,
    reclamations: complaints, risks, improvements: improvements.length,
    trainerReturns, startReminders: reminders, stakeholderSolicitations: solicitations,
    improvementsWithOrigin: improvements.filter((i: any) => i.source_analysis_id || (['evaluation', 'appreciation', 'reclamation'].includes(i.source_type) && (i.source_id || i.source_description?.trim()))).length,
  };
  return { facts: buildFacts(raw), sample: sample.map((t: any) => ({ trainingId: t.id, trainingName: t.training_name, endDate: t.end_date })) };
}