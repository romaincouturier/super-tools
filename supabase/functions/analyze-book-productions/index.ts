import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.110.0';
import { GatewayError } from '@lovable.dev/ai-gateway';
import { z } from 'zod';
import { createErrorResponse, createJsonResponse, handleCorsPreflightIfNeeded } from '../_shared/cors.ts';
import { verifyAuth, getSupabaseClient } from '../_shared/supabase-client.ts';
import { readMediaImage } from '../_shared/mission-tools.ts';
import { analyzeBookImage } from '../_shared/book-ai.ts';
import { hasManagedCronCredential, isCronOrServiceRole } from '../_shared/cron-auth.ts';

const bodySchema = z.object({ production_id: z.string().uuid().optional(), resume: z.boolean().optional() }).strict();

async function processBatch() {
  const db = getSupabaseClient();
  const run = crypto.randomUUID();
  const claimed = await db.rpc('claim_book_analysis', { p_run: run });
  if (claimed.error) throw claimed.error;
  try {
    for (const job of claimed.data ?? []) {
      const { data: control, error: controlError } = await db.from('book_analysis_control').select('pause_reason,lease_id').eq('id', true).single();
      if (controlError) throw controlError;
      if (control.pause_reason || control.lease_id !== run) break;
      try {
        const { data: p, error } = await db.from('book_productions').select('title,original_filename').eq('id', job.production_id).single();
        if (error) throw error;
        const image = await readMediaImage(db, job.production_id, false, async () => {});
        const analysis = await analyzeBookImage(image, job.snapshot.title, p.original_filename);
        const saved = await db.rpc('finish_book_analysis', { p_id: job.production_id, p_run: run, p_title: analysis.title, p_tags: analysis.tags, p_notes: analysis.notes });
        if (saved.error) throw saved.error;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Analyse impossible';
        const failed = await db.from('book_analysis_jobs').update({ status: 'error', error_message: message, finished_at: new Date().toISOString() }).eq('production_id', job.production_id).eq('run_id', run);
        if (failed.error) throw failed.error;
        const terminal = error instanceof GatewayError || message.startsWith('Refus du fournisseur');
        if (terminal) {
          const rate = error instanceof GatewayError && error.httpStatus === 429;
          const paused = await db.from('book_analysis_control').update({ pause_reason: message, resume_after: rate ? new Date(Date.now() + Math.max(3600000, (error.retryAfter ?? 0) * 1000)).toISOString() : null }).eq('id', true).eq('lease_id', run);
          if (paused.error) throw paused.error;
          const remaining = await db.from('book_analysis_jobs').update({ status: 'pending' }).eq('run_id', run).eq('status', 'processing');
          if (remaining.error) throw remaining.error;
          break;
        }
      }
    }
  } finally {
    const released = await db.from('book_analysis_control').update({ lease_until: null }).eq('id', true).eq('lease_id', run);
    if (released.error) throw released.error;
  }
}

serve(async req => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return createErrorResponse('POST requis', 405);
  try {
    const scheduled = await hasManagedCronCredential(req) || await isCronOrServiceRole(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return createErrorResponse('Requête invalide', 400);
    if (!scheduled) {
      const user = await verifyAuth(req.headers.get('Authorization'));
      if (!user) return createErrorResponse('Connexion requise', 401);
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_ANON_KEY');
      if (!url || !key) throw new Error('Configuration indisponible');
      const db = createClient(url, key, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
      if (parsed.data.resume) {
        const resumed = await db.rpc('resume_book_analysis');
        if (resumed.error) return createErrorResponse(resumed.error.message, 403);
      }
      if (parsed.data.production_id) {
        const queued = await db.rpc('request_book_analysis', { p_id: parsed.data.production_id });
        if (queued.error) return createErrorResponse(queued.error.message, 403);
      } else {
        const { data, error } = await db.from('book_productions').select('id').limit(1);
        if (error || !data?.length) return createErrorResponse('Accès Book requis', 403);
      }
    }
    EdgeRuntime.waitUntil(processBatch().catch(error => console.error('[book-analysis]', error)));
    return createJsonResponse({ queued: true });
  } catch (error) {
    console.error('[book-analysis]', error);
    return createErrorResponse('Impossible de lancer l’analyse du Book', 500);
  }
});