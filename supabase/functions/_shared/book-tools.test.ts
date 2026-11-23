import { expect, it, vi } from 'vitest';
import { searchBookProductions } from './book-tools';

it('recherche via la RPC de l’appelant et signe la vignette privée', async () => {
  const rpc = vi.fn(async () => ({ data: [{ id: 'p', album: { id: 'a', title: 'Atelier' }, title: 'Santé', tags: ['santé'], notes: 'Équipe', thumbnail: 'u/a/thumb.jpg' }], error: null }));
  const signed = vi.fn(async () => ({ data: { signedUrl: 'https://signed.test/image' }, error: null }));
  const from = vi.fn(() => ({ createSignedUrl: signed }));
  const results = await searchBookProductions({ rpc, storage: { from } } as any, { query: 'SANTE', album: 'Atelier', limit: 5 });
  expect(rpc).toHaveBeenCalledWith('search_book_productions', { p_query: 'SANTE', p_album: 'Atelier', p_limit: 5 });
  expect(from).toHaveBeenCalledWith('book-productions');
  expect(results[0].thumbnail).toBe('https://signed.test/image');
});
it('conserve un refus de lecture', async () => { await expect(searchBookProductions({ rpc: async () => ({ data: null, error: new Error('denied') }) } as any, { query: 'santé' })).rejects.toThrow('denied'); });
it.each([0, 101])('refuse une limite %s', async limit => { await expect(searchBookProductions({} as any, { query: 'santé', limit })).rejects.toThrow(); });
it('ne renvoie pas de lien brut si le stockage refuse', async () => {
  const rows = await searchBookProductions({ rpc: async () => ({ data: [{ thumbnail: 'p.jpg' }] }), storage: { from: () => ({ createSignedUrl: async () => ({ error: { message: 'denied' }, data: null }) }) } } as any, { query: 'équipe' });
  expect(rows[0].thumbnail).toBe(null);
});