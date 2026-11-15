import { describe, expect, it } from 'vitest';
import { auditChanges, escapeAuditHtml } from './qualiopi-summary';
import type { AutomaticIssue } from './qualiopi-checks';
const issue: AutomaticIssue = { indicator: 1, indicatorLabel: 'Information', checkId: '1.mentions', label: 'Mentions', detail: '21/24', kind: 'defaut', gradation: 'mineure_possible' };
describe('Bilan audit', () => {
  it('ne signale aucun changement pour les mêmes écarts', () => expect(auditChanges([issue], [issue]).changed).toBe(false));
  it('identifie les nouveaux écarts', () => expect(auditChanges([issue], []).added).toEqual([issue]));
  it('identifie les écarts résolus', () => expect(auditChanges([], [issue]).resolved).toEqual([issue]));
  it('signale un compteur actualisé', () => expect(auditChanges([{ ...issue, detail: '22/24' }], [issue]).updated).toHaveLength(1));
  it('échappe les contenus des données', () => expect(escapeAuditHtml('<img>')).toBe('&lt;img&gt;'));
});