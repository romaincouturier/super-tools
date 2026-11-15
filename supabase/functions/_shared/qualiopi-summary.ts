import { auditPlan, evaluateIndicator, summarize, type AuditFacts, type AutomaticIssue, type AnswerValue } from './qualiopi-checks.ts';

export function auditChanges(current: AutomaticIssue[], previous: AutomaticIssue[]) {
  const before = new Map(previous.map(i => [i.checkId, i]));
  const after = new Map(current.map(i => [i.checkId, i]));
  const added = current.filter(i => !before.has(i.checkId));
  const resolved = previous.filter(i => !after.has(i.checkId));
  const updated = current.filter(i => {
    const old = before.get(i.checkId);
    return old && (old.detail !== i.detail || old.kind !== i.kind || old.gradation !== i.gradation);
  });
  return { added, resolved, updated, changed: added.length + resolved.length + updated.length > 0 };
}

export function auditMailSummary(facts: AuditFacts, answers: Record<string, AnswerValue> = {}) {
  const plans = auditPlan();
  const findings = plans.map(p => evaluateIndicator(p, facts, answers));
  return {
    ...summarize(findings),
    questions: plans.flatMap(p => p.questions.filter(q => !answers[q.id]).map(q => `Indicateur ${p.indicator.number} : ${q.label}`)),
  };
}

export function escapeAuditHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}