import type { BookProduction } from '@/types/book';

export type BookSortMode = 'recent' | 'oldest' | 'custom';

export const BOOK_SORT_OPTIONS: { value: BookSortMode; label: string }[] = [
  { value: 'recent', label: 'Derniers importés d\'abord' },
  { value: 'oldest', label: 'Premiers importés d\'abord' },
  { value: 'custom', label: 'Ordre manuel' },
];

function timestamp(p: BookProduction): number {
  const raw = p.created_at;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(t) ? t : 0;
}

export function sortProductions(
  productions: BookProduction[],
  mode: BookSortMode,
): BookProduction[] {
  const arr = [...productions];
  if (mode === 'custom') {
    return arr.sort((a, b) => a.sort_order - b.sort_order);
  }
  const dir = mode === 'recent' ? -1 : 1;
  return arr.sort((a, b) => (timestamp(a) - timestamp(b)) * dir);
}
