import { describe, expect, it } from 'vitest';
import { auditChanges, auditEmailModel, escapeAuditHtml, renderAuditActions, shouldSendAuditSummary } from './qualiopi-summary';
import { buildFacts, evaluateIndicator, auditPlan, type AutomaticIssue, type RawAuditData } from './qualiopi-checks';
import { EDITABLE_EMAIL_DEFAULTS } from './editable-email-defaults';
const raw: RawAuditData = {
  sampleIds: ['t'], sampleTrainings: [{ id: 't', objectives: ['Objectif'], program_file_url: 'programme', supports_lms_course_id: null, trainer_id: 'trainer' }],
  activeFormations: [], submittedEvaluations: [], submittedSurveys: [], participants: [], adequacy: [],
  reglementUrl: 'pdf', activeVhdProcedures: 1, lmsModules: [], lmsLessons: [], lmsCourseIds: [], trainers: [], trainerDocumentOwners: [],
  watchItemsLastYear: 602, watchSourcesFollowed: 0, watchItemsLinkedToAction: 0, referentName: 'Romain', referentEmail: 'r@example.org',
  handicapPartnersActive: 7, coldEvaluationsSubmitted: 0, sponsorEvaluationsSubmitted: 0, funderAppreciations: 0, reclamations: [], risks: [], improvements: 6,
};
const issue: AutomaticIssue = { indicator: 1, indicatorLabel: 'Information', checkId: '1.mentions', label: 'Mentions', detail: '21/24', kind: 'defaut', gradation: 'mineure_possible' };
describe('Bilan audit', () => {
  it('ne signale aucun changement pour les mêmes écarts', () => expect(auditChanges([issue], [issue]).changed).toBe(false));
  it('identifie les nouveaux écarts', () => expect(auditChanges([issue], []).added).toEqual([issue]));
  it('identifie les écarts résolus', () => expect(auditChanges([], [issue]).resolved).toEqual([issue]));
  it('signale un compteur actualisé', () => expect(auditChanges([{ ...issue, detail: '22/24' }], [issue]).updated).toHaveLength(1));
  it('échappe les contenus des données', () => expect(escapeAuditHtml('<img>')).toBe('&lt;img&gt;'));
  it('utilise le même total par indicateur dans le titre et le bilan', () => {
    const model = auditEmailModel(buildFacts(raw));
    expect(model.summary.conforme + model.summary.aVerifier + model.summary.mineure + model.summary.majeure).toBe(22);
    expect(model.globalState).toContain(`${model.summary.conforme} OK / ${model.summary.aVerifier} à compléter / ${model.summary.mineure + model.summary.majeure} non conforme`);
    expect(new Set(model.actions.map(a => a.indicator)).size).toBe(model.actions.length);
    const template = EDITABLE_EMAIL_DEFAULTS.qualiopi_audit_summary;
    expect(template.subject.vous).toContain('{{global_state}}');
    expect(template.content.vous).toContain('{{global_state}}');
    expect(template.content.vous).not.toContain('questions_list');
  });
  it('priorise les majeures et donne une action, un lien et une estimation dans le mail', () => {
    const model = auditEmailModel(buildFacts(raw));
    expect(model.actions[0].priority).toBe(0);
    const html = renderAuditActions(model.actions);
    expect(html).toContain('Action :');
    expect(html).toContain('Temps estimé :');
    expect(html).toContain('https://academy.supertilt.fr/parametres?find=tab%3Atrainers');
    expect(html).toContain('Réponds dans l’audit');
    expect(html).not.toContain('Questions ouvertes');
  });
  it('limite le bilan inchangé aux trois priorités', () => {
    const full = auditEmailModel(buildFacts(raw));
    const same = auditEmailModel(buildFacts(raw), {}, true);
    expect(same.actions).toEqual(full.actions.slice(0, 3));
    expect(same.changeNote).toContain('Aucun changement');
  });
  it('ne renvoie pas un bilan identique le même jour à Paris', () => {
    expect(shouldSendAuditSummary(false, '2026-11-15T18:00:00Z', new Date('2026-11-15T21:20:00Z'))).toBe(false);
  });
  it('autorise le rappel court au changement de jour à Paris et les bilans modifiés', () => {
    expect(shouldSendAuditSummary(false, '2026-11-15T18:00:00Z', new Date('2026-11-15T23:01:00Z'))).toBe(true);
    expect(shouldSendAuditSummary(true, '2026-11-15T18:00:00Z', new Date('2026-11-15T21:20:00Z'))).toBe(true);
  });
  it('détecte le CV enregistré dans la fiche formateur sans document séparé', () => {
    expect(buildFacts({ ...raw, trainers: [{ id: 'r', competences: [], formations_suivies: [], cv_url: 'https://example.org/cv' }] }).trainersWithDocuments).toBe(1);
  });
  it('ne confond pas questionnaire envoyé et convocation effectivement journalisée', () => {
    expect(buildFacts({ ...raw, participants: [{ training_id: 't', needs_survey_sent_at: '2026-11-15' }] }).sampleWithConvocation).toBe(0);
    expect(buildFacts({ ...raw, invitationTrainingIds: ['t'] }).sampleWithConvocation).toBe(1);
  });
  it('détecte un positionnement à niveau zéro sans prétendre valider les prérequis', () => {
    const facts = buildFacts({ ...raw, submittedSurveys: [{ training_id: 't', prerequis_validation: null, niveau_actuel: 0 }] });
    expect(facts.sampleWithPositioning).toBe(1);
    expect(facts.sampleWithPrerequisiteCheck).toBe(0);
  });
  it('ne confond pas retour de satisfaction et notation des objectifs', () => {
    const facts = buildFacts({ ...raw, submittedEvaluations: [{ training_id: 't', objectifs_evaluation: [] }] });
    expect(facts.sampleWithEvaluations).toBe(1);
    expect(facts.sampleWithObjectiveRatings).toBe(0);
  });
  it('ne déclare pas un processus absent faute de réponses à froid', () => {
    const plan = auditPlan().find(p => p.indicator.number === 30);
    if (!plan) throw new Error('Indicateur 30 absent');
    const finding = evaluateIndicator(plan, buildFacts(raw), {});
    expect(finding.checks.find(c => c.id === '30.froid')?.status).toBe('unknown');
    expect(finding.pending).toContain('30.solicitations');
  });
  it('résout la question équipe pédagogique uniquement avec des retours réels', () => {
    const model = auditEmailModel(buildFacts({ ...raw, trainerReturns: 13, startReminders: 64 }));
    expect(model.summary.questions.some(q => q.includes('équipe pédagogique'))).toBe(false);
    expect(model.summary.questions.some(q => q.includes('ruptures de parcours'))).toBe(false);
    expect(auditEmailModel(buildFacts(raw)).summary.questions.some(q => q.includes('équipe pédagogique'))).toBe(true);
  });
});