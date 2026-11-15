import { describe, it, expect, vi } from 'vitest';
import { loadGameQuoteForSend } from './game-quote-send';

function fixture(status = 'draft', action = 'game_devis_draft') {
  const order = { id: 'quote', wc_status: status, customer_email: 'client@example.org', billing_address: { address_1: 'Rue test', postcode: '7100', city: 'La Louvière', country: 'BE' }, devis_activity_log_id: 'log' };
  const log = { id: 'log', action_type: action, details: { pdf_storage_path: 'stored.pdf', items: [{ title: 'ECHO', quantity: 2, unitPrice: 40 }], shipping_fee: 18 } };
  const from = vi.fn((table: string) => {
    const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: table === 'woocommerce_orders' ? order : log, error: null }) };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); return chain;
  });
  const sign = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.org/stored.pdf' } });
  return { from, storage: { from: vi.fn().mockReturnValue({ createSignedUrl: sign }) } };
}

describe('Envoi manuel du brouillon jeux', () => {
  it('refuse sans confirmation avant lecture ou envoi', async () => {
    const db = fixture();
    await expect(loadGameQuoteForSend(db, 'quote', false)).rejects.toThrow('Confirmez');
    expect(db.from).not.toHaveBeenCalled();
  });
  it('relit les deux ECHO et l’adresse belge sans créer de commande ou appeler Pennylane', async () => {
    const db = fixture();
    const result = await loadGameQuoteForSend(db, 'quote', true);
    if (result.alreadySent) throw new Error('Unexpected sent');
    expect(result.body.items).toEqual([{ title: 'ECHO', quantity: 2, unitPrice: 40 }]);
    expect(result.body.pays).toBe('BE');
    expect(result.body.emailCommanditaire).toBe('client@example.org');
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(['woocommerce_orders', 'activity_logs']);
    expect(result.pdfUrl).toBe('https://example.org/stored.pdf');
  });
  it('refuse une commande active', async () => {
    await expect(loadGameQuoteForSend(fixture('processing'), 'quote', true)).rejects.toThrow('brouillon');
  });
  it('ne renvoie pas un devis déjà envoyé', async () => {
    const db = fixture('draft', 'game_devis_sent');
    expect(await loadGameQuoteForSend(db, 'quote', true)).toEqual({ alreadySent: true });
    expect(db.storage.from).not.toHaveBeenCalled();
  });
});