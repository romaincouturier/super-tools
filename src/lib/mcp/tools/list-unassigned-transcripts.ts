import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
export default defineTool({name:'list_unassigned_transcripts',title:'Lister les transcripts non affectés',description:'Liste une page de transcripts prêts sans rattachement, formations comprises ; suivre next_offset pour continuer.',inputSchema:{limit:z.number().int().min(1).max(100).default(30),offset:z.number().int().min(0).default(0),search:z.string().max(200).optional()},annotations:{readOnlyHint:true},handler:async({limit,offset,search},ctx)=>{
 const db=await staffClient(ctx);
 let q=db.from('transcripts').select('id,title,ai_title,summary,created_at').eq('status','ready').order('created_at',{ascending:false}).order('id').range(offset,offset+limit-1);
 if(search)q=q.ilike('title',`%${search.replace(/[%_]/g,'')}%`);
 const {data,error}=await q;if(error)throw error;
 const ids=(data??[]).map(r=>r.id);if(!ids.length)return result({transcripts:[],next_offset:null});
 const a=await db.rpc('get_transcript_assignments').in('transcript_id',ids);if(a.error)throw a.error;
 const assigned=new Set((a.data??[]).map(r=>r.transcript_id));
 return result({transcripts:(data??[]).filter(r=>!assigned.has(r.id)),next_offset:data?.length===limit?offset+limit:null});
}});
