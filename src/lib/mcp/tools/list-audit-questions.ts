import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { auditClient, result } from '../supabase';
import { auditQuestionCatalog, evidenceAgeDays, evidenceStatus, latestEvidence } from '../../../../supabase/functions/_shared/audit-evidence';

export default defineTool({
  name: 'list_audit_questions',
  title: "Lister les questions manuelles de l'audit blanc",
  description: "Questions manuelles de l'audit blanc Qualiopi avec leur dernière preuve (réponse, date, source, statut valide/périmée/à confirmer/validation humaine requise). Indicateur 0 : préparation du jour d’audit, hors score.",
  inputSchema: { indicator: z.number().int().min(0).max(32).optional().describe('0 = préparation du jour d’audit, hors score') },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ indicator }, ctx) => {
    const db = await auditClient(ctx);
    const questions = auditQuestionCatalog().filter(q => !indicator || q.indicator === indicator);
    let query = db.from('audit_question_evidence').select('question_id, answer, evidence_summary, evidence_urls, checked_at, recorded_at, source_type, source_label').order('recorded_at', { ascending: false }).limit(1000);
    if (indicator) query = query.eq('indicator', indicator);
    const { data, error } = await query;
    if (error) throw error;
    const latest = latestEvidence(data ?? []);
    return result(questions.map(q => {
      const e = latest.get(q.question_id);
      return { ...q, current: e ? { ...e, age_days: evidenceAgeDays(e), status: evidenceStatus(e) } : null, status: evidenceStatus(e) };
    }));
  },
});
