import { supabase } from '@/integrations/supabase/client';

export async function getBookAnalysisStatus(productionIds: string[]) {
  if (!productionIds.length) return { jobs: [], pause: null as string | null };
  const [jobs, control] = await Promise.all([
    supabase.from('book_analysis_jobs').select('production_id,status,error_message').in('production_id', productionIds),
    supabase.from('book_analysis_control').select('pause_reason').eq('id', true).maybeSingle(),
  ]);
  if (jobs.error) throw jobs.error;
  if (control.error) throw control.error;
  return { jobs: jobs.data ?? [], pause: control.data?.pause_reason ?? null };
}