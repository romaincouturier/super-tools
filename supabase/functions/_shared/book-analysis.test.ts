import { expect, it } from 'vitest';
import { isRawBookTitle, normalizeBookAnalysis, normalizeBookSearch } from './book-analysis';

const response = { title: 'La santé de notre planète', tags: ['ÉCOLOGIE', 'Pollution', 'santé', 'équipe', 'pictogramme'], notes: 'Des pictogrammes illustrent les enjeux écologiques et sanitaires.' };
it.each(['IMG_4093', 'DSC_1234', 'DSCF1234'])('remplace le titre de fichier %s', title => {
  expect(normalizeBookAnalysis(response, title).title).toBe('La santé de notre planète');
});
it('préserve le titre manuel', () => { expect(normalizeBookAnalysis(response, 'Atelier Romain').title).toBe('Atelier Romain'); });
it('reconnaît le nom original sans extension', () => { expect(isRawBookTitle('ma-photo', 'ma-photo.jpeg')).toBe(true); });
it('produit cinq tags français minuscules', () => { expect(normalizeBookAnalysis(response, 'IMG_1').tags).toEqual(['écologie', 'pollution', 'santé', 'équipe', 'pictogramme']); });
it.each([4, 13])('refuse %s tags', count => { expect(() => normalizeBookAnalysis({ ...response, tags: Array.from({ length: count }, (_, i) => `tag${i}`) }, 'IMG_1')).toThrow(); });
it('refuse moins de cinq tags distincts', () => { expect(() => normalizeBookAnalysis({ ...response, tags: ['santé', 'santé', 'santé', 'santé', 'santé'] }, 'IMG_1')).toThrow(); });
it('normalise les accents et la casse de recherche', () => { expect(normalizeBookSearch('ÉCOLOGIE ŒUVRE')).toBe('ecologie oeuvre'); });