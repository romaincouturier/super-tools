import { describe, expect, it } from 'vitest';
import { collectAuditFacts } from './qualiopi-collector';

function database() {
  const calls: Array<[string, string, ...unknown[]]> = [];
  return { calls, from(table: string) {
    const rows = table === 'trainings' ? [{ id: 't', training_name: 'Session terminée', end_date: '2026-10-13', objectives: ['Objectif'], trainer_id: 'r' }] : [];
    const q: any = {};
    for (const method of ['select', 'eq', 'lt', 'gte', 'not', 'neq', 'in', 'order', 'limit', 'range']) {
      q[method] = (...args: unknown[]) => { calls.push([table, method, ...args]); return q; };
    }
    q.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, count: 0, error: null });
    return q;
  } };
}
describe('Collecte audit', () => {
  it('échantillonne les sessions terminées non annulées, pas celles simplement commencées', async () => {
    const db = database();
    const result = await collectAuditFacts(db, new Date('2026-11-15T21:20:00Z'));
    expect(db.calls).toContainEqual(['trainings', 'eq', 'is_cancelled', false]);
    expect(db.calls).toContainEqual(['trainings', 'lt', 'end_date', '2026-11-15']);
    expect(db.calls).toContainEqual(['trainings', 'order', 'end_date', { ascending: false }]);
    expect(result.sample[0].endDate).toBe('2026-10-13');
  });
  it('utilise les convocations journalisées et des lectures paginées pour les preuves', async () => {
    const db = database();
    await collectAuditFacts(db);
    expect(db.calls).toContainEqual(['sent_emails_log', 'in', 'email_type', ['welcome', 'scheduled_welcome', 'needs_survey', 'scheduled_needs_survey']]);
    expect(db.calls).toContainEqual(['lms_lessons', 'range', 0, 499]);
    expect(db.calls.some(c => ['insert', 'update', 'delete', 'upsert'].includes(c[1]))).toBe(false);
  });
  it('refuse de produire des défauts à partir d’une lecture échouée', async () => {
    const db = { from() {
      const q: any = {};
      for (const method of ['select', 'eq', 'lt', 'order', 'limit']) q[method] = () => q;
      q.then = (resolve: (value: unknown) => unknown) => resolve({ data: null, error: { message: 'refus de lecture' } });
      return q;
    } };
    await expect(collectAuditFacts(db)).rejects.toThrow('Lecture sessions terminées impossible : refus de lecture');
  });
});