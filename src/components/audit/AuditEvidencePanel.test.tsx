import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuditEvidencePanel } from './AuditEvidencePanel';
import type { AuditEvidence } from '@/services/auditEvidence';

const agentEvidence: AuditEvidence = {
  id: 'e1', question_id: '1.publie', indicator: 1, answer: 'oui',
  evidence_summary: 'Site contrôlé', evidence_urls: ['https://example.com'], evidence_details: null,
  source_label: 'Claude', source_type: 'agent', checked_at: '2026-11-26T08:00:00Z',
  recorded_at: '2026-11-26T08:01:00Z', recorded_by: null,
};

describe('AuditEvidencePanel', () => {
  it('transmet la preuve MCP à la validation humaine sans la modifier', async () => {
    const onValidate = vi.fn();
    render(<AuditEvidencePanel history={[agentEvidence]} onValidate={onValidate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Valider cette preuve' }));
    expect(onValidate).toHaveBeenCalledOnce();
    expect(onValidate).toHaveBeenCalledWith(agentEvidence);
  });

  it('ne propose pas de validation pour une preuve humaine valide', () => {
    render(<AuditEvidencePanel history={[{ ...agentEvidence, source_type: 'human' }]} onValidate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Valider cette preuve' })).not.toBeInTheDocument();
  });
});
