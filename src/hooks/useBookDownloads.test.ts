import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useBookDownloads } from './useBookDownloads';
import type { BookProduction } from '@/types/book';

const mocks = vi.hoisted(() => ({ download: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/bookDownloads', () => ({ downloadBookProduction: mocks.download }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));
const items = [{ id: '1' }, { id: '2' }, { id: '3' }] as BookProduction[];
beforeEach(() => { vi.clearAllMocks(); mocks.download.mockResolvedValue(undefined); });

it('interdit tout téléchargement en public', async () => {
  const { result } = renderHook(() => useBookDownloads(false));
  await act(async () => { await result.current.download(items); });
  expect(mocks.download).not.toHaveBeenCalled();
});

it('télécharge séquentiellement et compte seulement les réussites', async () => {
  let active = 0;
  let peak = 0;
  mocks.download.mockImplementation(async (item) => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    if (item.id === '2') throw new Error('échec');
  });
  const { result } = renderHook(() => useBookDownloads(true));
  await act(async () => { await result.current.download(items); });
  expect(peak).toBe(1);
  expect(mocks.download.mock.calls.map(([item]) => item.id)).toEqual(['1', '2', '3']);
  expect(mocks.toast).toHaveBeenCalledWith({ title: '2 fichiers téléchargés' });
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
});