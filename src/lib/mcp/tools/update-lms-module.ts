import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { modulePatch } from '../schemas';
import { staffClient,result } from '../supabase';
export default defineTool({name:'update_lms_module',title:'Modifier un module',description:'Modifie titre, description ou position avec valeurs avant/après, sans changer les leçons.',inputSchema:{module_id:z.string().uuid(),patch:modulePatch},handler:async({module_id,patch},ctx)=>{const db=await staffClient(ctx);const {data,error}=await db.rpc('mcp_save_lms_module',{p_course_id:null,p_module_id:module_id,p_patch:patch});if(error)throw error;return result(data);}});
