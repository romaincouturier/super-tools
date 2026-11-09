import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { coverPatch } from '../schemas';
import { staffClient,result } from '../supabase';
export default defineTool({name:'update_lms_course',title:'Modifier la couverture d’un cours',description:'Modifie uniquement cover_image_url HTTPS ou null, avec valeurs avant/après.',inputSchema:{course_id:z.string().uuid(),patch:coverPatch},handler:async({course_id,patch},ctx)=>{const db=await staffClient(ctx);const before=await db.from('lms_courses').select('id,title,cover_image_url').eq('id',course_id).single();if(before.error)throw before.error;const {data,error}=await db.from('lms_courses').update(patch).eq('id',course_id).select('id,title,cover_image_url').single();if(error)throw error;return result({before:before.data,after:data});}});
