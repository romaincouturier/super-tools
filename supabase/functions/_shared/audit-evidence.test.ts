import { describe, expect, it } from 'vitest';
import { evidenceStatus, isKnownAuditQuestion, latestEvidence, mergeEvidenceAnswers } from './audit-evidence';
import { auditEmailModel } from './qualiopi-summary';
import { buildFacts, type RawAuditData } from './qualiopi-checks';

const now = new Date('2026-11-19T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const row = (question_id: string, answer: 'oui' | 'non', d: number, rec = daysAgo(d)) => ({ question_id, answer, checked_at: daysAgo(d), recorded_at: rec });

describe('Preuves audit blanc', () => {
  it('une preuve de 44 jours est valide', () => expect(evidenceStatus(row('1.publie', 'oui', 44), now)).toBe('valide'));
  it('une preuve de 45 jours est périmée', () => expect(evidenceStatus(row('1.publie', 'oui', 45), now)).toBe('perimee'));
  it('sans preuve : à confirmer', () => expect(evidenceStatus(null, now)).toBe('a_confirmer'));
  it('la dernière preuve enregistrée l’emporte', () => {
    const l = latestEvidence([row('1.publie', 'non', 10, daysAgo(10)), row('1.publie', 'oui', 2, daysAgo(1))]);
    expect(l.get('1.publie')?.answer).toBe('oui');
  });
  it('une preuve valide fixe la réponse, une périmée la retire', () => {
    const m = mergeEvidenceAnswers({ '1.publie': 'oui', '1.trompeuse': 'oui' }, [row('1.publie', 'non', 3), row('1.trompeuse', 'oui', 60)], now);
    expect(m['1.publie']).toBe('non');
    expect('1.trompeuse' in m).toBe(false);
  });
  it('ignore une question inconnue', () => {
    expect(isKnownAuditQuestion('1.inconnue')).toBe(false);
    expect(mergeEvidenceAnswers({}, [row('1.inconnue', 'oui', 1)], now)).toEqual({});
  });
});

const raw: RawAuditData = {
  sampleIds: ['t'], sampleTrainings: [{ id: 't', objectives: ['Objectif'], program_file_url: 'programme', supports_lms_course_id: null, trainer_id: 'trainer' }],
  activeFormations: [], submittedEvaluations: [], submittedSurveys: [], participants: [], adequacy: [],
  reglementUrl: 'pdf', activeVhdProcedures: 1, lmsModules: [], lmsLessons: [], lmsCourseIds: [], trainers: [], trainerDocumentOwners: [],
  watchItemsLastYear: 602, watchSourcesFollowed: 0, watchItemsLinkedToAction: 0, referentName: 'Romain', referentEmail: 'r@example.org',
  handicapPartnersActive: 7, coldEvaluationsSubmitted: 0, sponsorEvaluationsSubmitted: 0, funderAppreciations: 0, reclamations: [], risks: [], improvements: 6,
};
const tasks = (answers: Record<string, 'oui' | 'non' | null>) =>
  auditEmailModel(buildFacts(raw), answers).actions.flatMap(a => a.tasks.map(t => t.recommendation));
const label = 'Confirme avec une preuve : Ces informations sont-elles accessibles au public, hors de l\'application ?';

describe('Tâches « Confirme avec une preuve »', () => {
  it('disparaît avec une preuve oui récente', () => expect(tasks(mergeEvidenceAnswers({}, [row('1.publie', 'oui', 5)], now))).not.toContain(label));
  it('revient quand la preuve est périmée', () => expect(tasks(mergeEvidenceAnswers({ '1.publie': 'oui' }, [row('1.publie', 'oui', 50)], now))).toContain(label));
  it('reste présente sans preuve', () => expect(tasks({})).toContain(label));
});
