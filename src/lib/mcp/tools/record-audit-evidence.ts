import { defineTool, ToolError } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { auditClient, result } from '../supabase';
import { auditQuestionCatalog } from '../../../../supabase/functions/_shared/audit-evidence';

export const recordAuditEvidenceInput = {
  question_id: z.string().min(3).max(60).describe('Identifiant stable, ex. 1.publie'),
  answer: z.enum(['oui', 'non']),
  evidence_summary: z.string().trim().min(1).max(5000),
  evidence_urls: z.array(z.string().url().refine(u => /^https?:\/\//.test(u), 'URL http(s) attendue')).max(50).default([]),
  evidence_details: z.union([z.string().max(100000), z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional().describe('Texte ou JSON : citations par page et par élément, mentions vérifiées ou trompeuses'),
  checked_at: z.string().datetime({ offset: true }).describe('Date et heure du contrôle (ISO 8601)'),
  source: z.string().regex(/^agent:.+/, 'Format attendu : agent:<nom de la tâche>').max(200),
};

export default defineTool({
  name: 'record_audit_evidence',
  title: "Enregistrer une preuve d'audit blanc",
  description: "Ajoute une réponse oui/non avec sa preuve à une question manuelle de l'audit blanc. Historique conservé, jamais d'écrasement ni de suppression.",
  inputSchema: recordAuditEvidenceInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const question = auditQuestionCatalog().find(q => q.question_id === input.question_id);
    if (!question) throw new ToolError(`Question inconnue : ${input.question_id}. Utiliser list_audit_questions.`);
    const db = await auditClient(ctx);
    const previous = await db.from('audit_question_evidence').select('id, answer, checked_at, recorded_at, source_type, source_label').eq('question_id', question.question_id).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
    if (previous.error) throw previous.error;
    const details = input.evidence_details === undefined ? null : typeof input.evidence_details === 'string' ? { text: input.evidence_details } : input.evidence_details;
    const { data, error } = await db.from('audit_question_evidence').insert({
      question_id: question.question_id, indicator: question.indicator, answer: input.answer,
      evidence_summary: input.evidence_summary, evidence_urls: input.evidence_urls,
      evidence_details: details as never, checked_at: input.checked_at,
      source_type: 'agent', source_label: input.source, recorded_by: ctx.getUserId(),
    }).select('id, question_id, indicator, answer, checked_at, recorded_at, source_type, source_label').single();
    if (error) throw new ToolError(error.message);
    return result({ recorded: data, previous: previous.data });
  },
});
