import { AUDIT_DAY_QUESTIONS, auditPlan, type AnswerValue } from './qualiopi-checks.ts';

/** Une preuve vivante plus ancienne que ce délai redevient à confirmer. */
export const AUDIT_EVIDENCE_MAX_AGE_DAYS = 45;
export const AUDIT_ANNUAL_EVIDENCE_MAX_AGE_DAYS = 365;
const DAY_MS = 86_400_000;
const ANNUAL_QUESTIONS = new Set(['23.comptes', '12.information', '12.sanctions', '12.ressources', '32.revue']);

export interface AuditEvidenceRow {
  question_id: string;
  answer: 'oui' | 'non';
  checked_at: string;
  recorded_at: string;
  source_type?: 'human' | 'agent' | string;
}

export type AuditEvidenceStatus = 'valide' | 'perimee' | 'a_confirmer' | 'a_valider_humain';

export function auditQuestionCatalog() {
  return [
    ...auditPlan().flatMap(p => p.questions.map(q => ({ question_id: q.id, indicator: p.indicator.number, label: q.label, hint: q.hint ?? null }))),
    ...AUDIT_DAY_QUESTIONS.map(q => ({ question_id: q.id, indicator: 0, label: q.label, hint: q.hint ?? null })),
  ];
}

export function isKnownAuditQuestion(id: string) {
  return auditQuestionCatalog().some(q => q.question_id === id);
}

export function evidenceAgeDays(row: Pick<AuditEvidenceRow, 'checked_at'>, now = new Date()) {
  return Math.floor((now.getTime() - new Date(row.checked_at).getTime()) / DAY_MS);
}

export function evidenceMaxAgeDays(questionId: string) {
  return ANNUAL_QUESTIONS.has(questionId) || (questionId.startsWith('0.') && questionId !== '0.transition')
    ? AUDIT_ANNUAL_EVIDENCE_MAX_AGE_DAYS
    : AUDIT_EVIDENCE_MAX_AGE_DAYS;
}

export function evidenceStatus(row: Pick<AuditEvidenceRow, 'checked_at' | 'source_type' | 'question_id'> | null | undefined, now = new Date()): AuditEvidenceStatus {
  if (!row) return 'a_confirmer';
  if (evidenceAgeDays(row, now) >= evidenceMaxAgeDays(row.question_id)) return 'perimee';
  return row.source_type === 'agent' ? 'a_valider_humain' : 'valide';
}

/** Dernière preuve enregistrée par question, humaine ou collectée par MCP. */
export function latestEvidence<T extends AuditEvidenceRow>(rows: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.question_id);
    if (!current || row.recorded_at > current.recorded_at) latest.set(row.question_id, row);
  }
  return latest;
}

/**
 * Une preuve MCP documente un contrôle mais ne vaut pas validation humaine.
 * Seule une réponse humaine récente fixe le oui/non utilisé par l’audit.
 */
export function mergeEvidenceAnswers(answers: Record<string, AnswerValue>, rows: AuditEvidenceRow[], now = new Date()): Record<string, AnswerValue> {
  const merged = { ...answers };
  for (const [id, row] of latestEvidence(rows.filter(r => isKnownAuditQuestion(r.question_id)))) {
    if (row.source_type === 'agent' || evidenceStatus(row, now) !== 'valide') delete merged[id];
    else merged[id] = row.answer;
  }
  return merged;
}
