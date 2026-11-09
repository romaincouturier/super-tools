import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { sourcePatch } from '../schemas';
import { staffClient,result } from '../supabase';
export default defineTool({name:'update_watch_source',title:'Modifier une source de veille',description:'Modifie les champs explicitement fournis et retourne avant/après.',inputSchema:{source_id:z.string().uuid(),patch:sourcePatch},handler:async({source_id,patch},ctx)=>{const db=await staffClient(ctx);const before=await db.from('watch_sources').select('*').eq('id',source_id).single();if(before.error)throw before.error;const {data,error}=await db.from('watch_sources').update(patch).eq('id',source_id).select('*').single();if(error)throw error;return result({before:before.data,after:data});}});
