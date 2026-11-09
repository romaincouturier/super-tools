import { supabase } from '@/integrations/supabase/client';
export async function fetchTrainingTranscripts(trainingId:string){const {data,error}=await supabase.from('training_transcripts').select('id,created_at,transcripts(id,title,ai_title,created_at,duration_seconds)').eq('training_id',trainingId).order('created_at',{ascending:false});if(error)throw error;return data??[];}
