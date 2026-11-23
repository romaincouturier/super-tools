import { z } from 'zod';

export const bookAnalysisSchema = z.object({
  title: z.string().trim().min(1).max(180),
  tags: z.array(z.string().trim().min(1).max(60)).min(5).max(12),
  notes: z.string().trim().min(1).max(800),
});

export function isRawBookTitle(title: string, filename?: string | null) {
  const value = title.trim();
  return /^(?:IMG|DSC|DSCF|DSCN|PXL|IMAGE|PHOTO)[_ -]?\d[\w .()-]*$/i.test(value)
    || (!!filename && value === filename.replace(/\.[^.]+$/, ''));
}

export function normalizeBookAnalysis(value: unknown, currentTitle: string, filename?: string | null) {
  const parsed = bookAnalysisSchema.parse(value);
  const tags = [...new Set(parsed.tags.map(tag => tag.toLocaleLowerCase('fr').trim()))];
  if (tags.length < 5) throw new Error('L’analyse doit fournir au moins cinq tags distincts');
  return { title: isRawBookTitle(currentTitle, filename) ? parsed.title : currentTitle, tags, notes: parsed.notes };
}

export function normalizeBookSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}