import { auditPlan, type AnswerValue } from './qualiopi-checks.ts';

/** Une preuve d'audit plus ancienne que ce délai redevient à confirmer. */
export const AUDIT_EVIDENCE_MAX_AGE_DAYS = 45;
const DAY_MS = 86_400_000;

export interface AuditEvidenceRow {
  question_id: string;
  answer: 'oui' | 'non';
  checked_at: string;
  recorded_at: string;
}

export type AuditEvidenceStatus = 'valide' | 'perimee' | 'a_confirmer';

export function auditQuestionCatalog() {
  return auditPlan().flatMap(p => p.questions.map(q => ({ question_id: q.id, indicator: p.indicator.number, label: q.label, hint: q.hint ?? null })));
}

export function isKnownAuditQuestion(id: string) {
  return auditQuestionCatalog().some(q => q.question_id === id);
}

export function evidenceAgeDays(row: Pick<AuditEvidenceRow, 'checked_at'>, now = new Date()) {
  return Math.floor((now.getTime() - new Date(row.checked_at).getTime()) / DAY_MS);
}

export function evidenceStatus(row: Pick<AuditEvidenceRow, 'checked_at'> | null | undefined, now = new Date()): AuditEvidenceStatus {
  if (!row) return 'a_confirmer';
  return evidenceAgeDays(row, now) < AUDIT_EVIDENCE_MAX_AGE_DAYS ? 'valide' : 'perimee';
}

/** Dernière preuve enregistrée par question. */
export function latestEvidence<T extends AuditEvidenceRow>(rows: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.question_id);
    if (!current || row.recorded_at > current.recorded_at) latest.set(row.question_id, row);
  }
  return latest;
}

/**
 * Fusionne les réponses d'un passage avec les preuves : une preuve récente
 * fixe la réponse, une preuve périmée la retire (la question redevient à
 * confirmer). Les questions sans preuve gardent la réponse du passage.
 */
export function mergeEvidenceAnswers(answers: Record<string, AnswerValue>, rows: AuditEvidenceRow[], now = new Date()): Record<string, AnswerValue> {
  const merged = { ...answers };
  for (const [id, row] of latestEvidence(rows.filter(r => isKnownAuditQuestion(r.question_id)))) {
    if (evidenceStatus(row, now) === 'valide') merged[id] = row.answer;
    else delete merged[id];
  }
  return merged;
}
