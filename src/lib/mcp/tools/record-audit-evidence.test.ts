import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import tool, { recordAuditEvidenceInput } from './record-audit-evidence';
const schema = z.object(recordAuditEvidenceInput);
const base = { question_id: '1.publie', answer: 'oui', evidence_summary: 'OK', evidence_urls: ['https://supertilt.fr/formation'], checked_at: '2026-11-19T10:00:00+01:00', source: 'agent:controle-site' };
describe('record_audit_evidence', () => {
  it('accepte une preuve complète', () => expect(schema.safeParse(base).success).toBe(true));
  it('refuse une source sans agent:', () => expect(schema.safeParse({ ...base, source: 'romain' }).success).toBe(false));
  it('refuse une URL invalide', () => expect(schema.safeParse({ ...base, evidence_urls: ['pas une url'] }).success).toBe(false));
  it('refuse une réponse autre que oui/non', () => expect(schema.safeParse({ ...base, answer: 'peut-être' }).success).toBe(false));
  it('refuse une question inconnue', async () => {
    await expect((tool as unknown as { handler: (i: unknown, c: unknown) => Promise<unknown> }).handler({ ...base, question_id: '1.inconnue' }, {})).rejects.toThrow('Question inconnue');
  });
});
