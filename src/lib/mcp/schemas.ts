import { z } from 'zod';
export const modulePatch=z.object({title:z.string().trim().min(1).max(255).optional(),description:z.string().max(10000).nullable().optional(),position:z.number().int().min(0).optional()}).strict();
export const coverPatch=z.object({cover_image_url:z.string().url().refine(v=>v.startsWith('https://')).nullable()}).strict();
export const sourcePatch=z.object({status:z.enum(['proposed','to_subscribe','followed','dropped']).optional(),usefulness:z.number().int().min(1).max(5).nullable().optional(),notes:z.string().max(10000).optional(),theme:z.string().max(255).optional()}).strict();
