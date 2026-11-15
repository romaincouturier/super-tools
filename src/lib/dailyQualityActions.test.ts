import { describe, it, expect } from 'vitest';
import { visibleDailyActions } from './dailyQualityActions';
const row = { id: '1', category: 'qualiopi', action_date: '2026-11-09', title: 'Écart', description: null, link: null, is_completed: false, completed_at: null, auto_completed: false, entity_type: 'qualiopi_check', entity_id: '1.mentions' };
describe('Actions qualité persistantes', () => {
  it('montre un écart non résolu ancien', () => expect(visibleDailyActions([row], '2026-11-15')).toHaveLength(1));
  it('affiche une seule action par écart', () => expect(visibleDailyActions([row, { ...row, id: '2' }], '2026-11-15')).toHaveLength(1));
  it('masque les écarts fermés', () => expect(visibleDailyActions([{ ...row, is_completed: true }], '2026-11-15')).toHaveLength(0));
  it('affiche les 32 sources proposées anciennes', () => expect(visibleDailyActions(Array.from({ length: 32 }, (_, i) => ({ ...row, id: String(i), category: 'watch_sources_validate', entity_id: String(i) })), '2026-11-15')).toHaveLength(32));
  it('conserve le filtrage du jour pour les autres actions', () => expect(visibleDailyActions([{ ...row, category: 'missions_actions' }], '2026-11-15')).toHaveLength(0));
});