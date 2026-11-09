import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
export default defineTool({name:'create_lms_module',title:'Créer un module',description:'Crée un module en fin ou à une position explicite, sans modifier les leçons.',inputSchema:{course_id:z.string().uuid(),title:z.string().trim().min(1).max(255),description:z.string().max(10000).optional(),position:z.number().int().min(0).optional()},handler:async({course_id,...patch},ctx)=>{const db=await staffClient(ctx);const {data,error}=await db.rpc('mcp_save_lms_module',{p_course_id:course_id,p_module_id:null,p_patch:patch});if(error)throw error;return result(data);}});
