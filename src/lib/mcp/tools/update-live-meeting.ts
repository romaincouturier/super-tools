import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { staffClient,result } from '../supabase';
import { LIVE_STATUSES,replayPostContent } from '../live-meeting-shared';
const FULL='id,training_id,title,description,scheduled_at,duration_minutes,meeting_url,replay_url,run_notes,status,meeting_type,updated_at';
export default defineTool({name:'update_live_meeting',title:'Update a training live meeting',description:'Updates only the provided fields of a live session and returns before/after. Adding a first replay_url behaves like the app screen: learners get the in-app "replay available" notification and a replay post is published in the course community. If the live stays "scheduled" with a replay, the response proposes setting status to "completed" (call again to apply). Changing scheduled_at reschedules the 6-hour reminder emails like the app. No other email is sent.',inputSchema:{live_meeting_id:z.string().uuid(),replay_url:z.string().url().nullable().optional(),status:z.enum(LIVE_STATUSES).optional(),title:z.string().trim().min(1).max(255).optional(),scheduled_at:z.string().datetime({offset:true}).optional(),duration_minutes:z.number().int().min(1).max(1440).optional(),meeting_url:z.string().url().nullable().optional(),description:z.string().max(10000).nullable().optional(),run_notes:z.string().max(20000).nullable().optional()},annotations:{idempotentHint:false},handler:async({live_meeting_id,...patch},ctx)=>{
 if(Object.keys(patch).length===0)throw new Error('No field to update');
 const db=await staffClient(ctx);
 const before=await db.from('training_live_meetings').select(FULL).eq('id',live_meeting_id).single();if(before.error)throw before.error;
 const {data:after,error}=await db.from('training_live_meetings').update(patch).eq('id',live_meeting_id).select(FULL).single();if(error)throw error;
 const side:Record<string,unknown>={};
 const prevReplay=before.data.replay_url?.trim()||null;const newReplay=after.replay_url?.trim()||null;
 if(!prevReplay&&newReplay){
  const t=await db.from('trainings').select('supports_lms_course_id').eq('id',after.training_id).maybeSingle();
  const courseId=(t.data as {supports_lms_course_id?:string|null}|null)?.supports_lms_course_id;const email=ctx.getUserEmail();
  if(courseId&&email){const p=await db.from('practice_posts').insert({course_id:courseId,author_email:email,content:replayPostContent(after.title,`https://academy.supertilt.fr/lms/${courseId}/home?view=calendar`),is_pinned:false}).select('id').single();side.community_post=p.error?{error:p.error.message}:{id:p.data.id};}
  else side.community_post={skipped:courseId?'no caller email':'training has no LMS course'};
 }
 if(patch.scheduled_at&&patch.scheduled_at!==before.data.scheduled_at){
  const del=await db.from('scheduled_emails').delete().eq('training_id',after.training_id).eq('email_type','live_reminder').eq('status','pending').like('error_message',`%live:${live_meeting_id}%`);
  const reminder=new Date(Date.parse(after.scheduled_at)-6*3600*1000);let scheduled=0;
  if(!del.error&&reminder>new Date()){const ps=await db.from('training_participants').select('id').eq('training_id',after.training_id);if(ps.error)throw ps.error;const rows=(ps.data??[]).map(p=>({training_id:after.training_id,participant_id:p.id,email_type:'live_reminder',scheduled_for:reminder.toISOString(),error_message:`live:${live_meeting_id}`}));if(rows.length){const ins=await db.from('scheduled_emails').insert(rows);if(ins.error)throw ins.error;scheduled=rows.length;}}
  side.reminders=del.error?{error:del.error.message}:{rescheduled:scheduled};
 }
 const proposal=newReplay&&after.status==='scheduled'?{suggested_status:'completed',message:'A replay is set but the live is still "scheduled". Call update_live_meeting with status "completed" to mark it as done, as the app does.'}:undefined;
 return result({before:before.data,after,side_effects:side,...(proposal?{proposal}:{})});
}});
