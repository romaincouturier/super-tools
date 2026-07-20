import type { BookProduction } from '@/types/book';

export type BookSortMode = 'recent' | 'oldest' | 'custom';

export const BOOK_SORT_OPTIONS: { value: BookSortMode; label: string }[] = [
  { value: 'recent', label: 'Plus récent d\'abord' },
  { value: 'oldest', label: 'Plus ancien d\'abord' },
  { value: 'custom', label: 'Ordre manuel' },
];

function timestamp(p: BookProduction): number {
  const raw = p.exif_date ?? p.created_at;
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
