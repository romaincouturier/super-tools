import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  write: vi.fn(),
  rpc: vi.fn(),
  client: vi.fn(),
}));
vi.mock('../supabase', () => ({
  dropshippingClient: mocks.client,
  result: (data: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] }),
}));
vi.mock('../../../../supabase/functions/_shared/game-quote-writer', () => ({ confirmGameQuote: mocks.write }));
vi.mock('../game-quote-shared', async (importOriginal) => ({ ...(await importOriginal<typeof import('../game-quote-shared')>()), prepareGameQuote: mocks.prepare }));

import tool from './create-game-quote';

const input = {
  client: { type: 'company', company: 'CLPS', email: 'pauline.delsoir@clpsms.be', billing_address: { address_1: 'Rue de la Loi 30', postcode: '7100', city: 'La Louvière', country: 'BE' } },
  lines: [{ title: 'ECHO', quantity: 2 }],
};
const db = { rpc: mocks.rpc };

describe('create_game_quote : barrière preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.mockResolvedValue(db);
  });

  it('confirm absent reste un preview sans PDF, RPC ou écriture', async () => {
    mocks.prepare.mockResolvedValue({ mode: 'preview', ready: false, issues: ['price missing'], write_performed: false });
    const response = await tool.handler(input as any, {} as any);
    expect(mocks.prepare).toHaveBeenCalledWith(db, expect.objectContaining({ confirm: false }));
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(JSON.parse((response as any).content[0].text).write_performed).toBe(false);
  });

  it('confirm=true refuse un preview incomplet avant tout effet externe', async () => {
    mocks.prepare.mockResolvedValue({ mode: 'preview', ready: false, issues: ['price missing'], amounts: null });
    await expect(tool.handler({ ...input, confirm: true } as any, {} as any)).rejects.toThrow('price missing');
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
