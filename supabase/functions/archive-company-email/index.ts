import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { COMPANY_ARCHIVE_CATEGORIES } from '../_shared/company-archives.ts';
import { archiveGmailAttachments } from '../_shared/company-archive-email.ts';

const schema = z.object({ gmail_message_id: z.string().trim().min(1).max(300), attachment_filenames: z.array(z.string().min(1).max(255)).min(1).max(50).optional(), category: z.enum(COMPANY_ARCHIVE_CATEGORIES), valid_until: z.string().optional() }).strict();
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return reply({ error: 'Méthode refusée' }, 405);
  try {
    const header = req.headers.get('Authorization');
    if (!header?.startsWith('Bearer ')) return reply({ error: 'Connexion requise' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_ANON_KEY') || '', { global: { headers: { Authorization: header } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(header.slice(7));
    if (authError || !user) return reply({ error: 'Connexion invalide' }, 401);
    const { data: admin, error } = await db.rpc('is_admin', { _user_id: user.id });
    if (error || admin !== true) return reply({ error: 'Accès administrateur aux archives requis' }, 403);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: parsed.error.flatten() }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY'); const gmail = Deno.env.get('GOOGLE_MAIL_API_KEY');
    if (!key || !gmail) return reply({ error: 'Connexion Gmail non configurée' }, 503);
    const get = async (path: string) => {
      const response = await fetch(`https://connector-gateway.lovable.dev/google_mail/gmail/v1${path}`, { headers: { Authorization: `Bearer ${key}`, 'X-Connection-Api-Key': gmail }, signal: req.signal });
      if (!response.ok) throw new Error(`Gmail [${response.status}] : ${await response.text()}`);
      return response.json();
    };
    return reply(await archiveGmailAttachments(db, parsed.data, get));
  } catch (e) { return reply({ error: e instanceof Error ? e.message : String(e) }, 400); }
});