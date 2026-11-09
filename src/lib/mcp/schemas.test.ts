import { describe,it,expect } from 'vitest';
import { modulePatch,coverPatch,sourcePatch } from './schemas';
describe('Champs MCP autorisés',()=>{
 it('interdit le contenu de leçon dans un module',()=>{expect(modulePatch.safeParse({title:'Module',content_html:'x'}).success).toBe(false);});
 it('couverture HTTPS ou null seulement',()=>{expect(coverPatch.safeParse({cover_image_url:'http://example.org/x'}).success).toBe(false);expect(coverPatch.parse({cover_image_url:null})).toEqual({cover_image_url:null});expect(coverPatch.safeParse({cover_image_url:null,title:'autre'}).success).toBe(false);});
 it('utilité comprise entre 1 et 5',()=>{expect(sourcePatch.safeParse({usefulness:6}).success).toBe(false);expect(sourcePatch.parse({usefulness:5})).toEqual({usefulness:5});});
});
