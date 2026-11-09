import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
export default defineTool({name:'list_lms_modules',title:'Lister les modules',description:'Liste les modules ordonnés, y compris vides, avec nombre de leçons.',inputSchema:{course_id:z.string().uuid()},annotations:{readOnlyHint:true},handler:async({course_id},ctx)=>{const db=await staffClient(ctx);const {data,error}=await db.from('lms_modules').select('id,title,description,position,lms_lessons(count)').eq('course_id',course_id).order('position').order('id');if(error)throw error;return result(data);}});
