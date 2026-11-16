import { describe, expect, it, vi } from 'vitest';
import type { ToolContext } from '@lovable.dev/mcp-js';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabaseForUser: () => ({ rpc }) }));
import { archiveClient } from './company-archives';
const ctx = { getUserId: () => 'caller-id' } as ToolContext;
describe('droits archives MCP', () => {
  it('refuse un utilisateur non administrateur', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(archiveClient(ctx)).rejects.toThrow('administrateur');
    expect(rpc).toHaveBeenCalledWith('is_admin', { _user_id: 'caller-id' });
  });
  it('refuse une erreur de validation des droits', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'refus' } });
    await expect(archiveClient(ctx)).rejects.toThrow('administrateur');
  });
  it('accepte seulement un administrateur vérifié', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(archiveClient(ctx)).resolves.toEqual({ rpc });
  });
});