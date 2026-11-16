import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse } from "../_shared/cors.ts";
import { hasManagedCronCredential, isCronOrServiceRole } from "../_shared/cron-auth.ts";
import { automaticIssues } from "../_shared/qualiopi-checks.ts";
import { auditChanges, auditMailSummary, auditFocusModel, renderAuditActions, shouldSendAuditSummary } from '../_shared/qualiopi-summary.ts';
import { sendEmail } from '../_shared/resend.ts';
import { getBccList, getSenderEmail } from '../_shared/email-settings.ts';
import { getSigniticSignature } from '../_shared/signitic.ts';
import { renderCatalogEmail } from '../_shared/editable-email.ts';
import { collectAuditFacts } from '../_shared/qualiopi-collector.ts';
import { verifyAuth } from '../_shared/supabase-client.ts';

/**
 * Audit blanc automatique, chaque nuit.
 *
 * La tâche ne rend pas de verdict complet : un audit ne conclut pas sur ce
 * qu'il n'a pas regardé, et les questions posées à l'auditeur n'ont pas de
 * réponse ici. Elle fait ce qu'une machine peut faire seule : repasser les
 * contrôles sur les données, figer les faits du jour, et inscrire chaque
 * constat en défaut dans les actions quotidiennes.
 *
 * La réconciliation conserve une action active par écart, sans dépendre de
 * sa date initiale, et ferme les écarts corrigés ainsi que les doublons.
 */

const VERSION = "run-qualiopi-audit@2026-11-16.1";
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    // Planification gérée Lovable Cloud (LOVABLE_CRON_SECRET), ou secret dédié
    // QUALIOPI_CRON_SECRET (règle [036]) pour un appel manuel interne.
    let authorized = (await hasManagedCronCredential(req)) ||
      (await isCronOrServiceRole(req, "QUALIOPI_CRON_SECRET"));

    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Configuration serveur absente');
    const supabase = createClient(url, key);
    if (!authorized) {
      const user = await verifyAuth(req.headers.get('Authorization'));
      if (user) {
        const admin = await supabase.rpc('is_admin', { _user_id: user.id });
        if (admin.error) throw admin.error;
        authorized = admin.data === true;
      }
    }
    if (!authorized) return createErrorResponse('Unauthorized', 401);

    const { facts, sample } = await collectAuditFacts(supabase);
    const sampleIds = sample.map(t => t.trainingId);
    const issues = automaticIssues(facts);

    const focusRead = await supabase.from('audit_runs').select('facts').like('notes', 'Passage automatique%').order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (focusRead.error) throw focusRead.error;
    const sentRead = await supabase.from('audit_runs').select('id, findings, facts, answers, summary_email_sent_at').not('summary_email_sent_at', 'is', null).order('summary_email_sent_at', { ascending: false }).limit(1).maybeSingle();
    if (sentRead.error) throw sentRead.error;
    const answersRead = await supabase.from('audit_runs').select('answers, sample_training_ids')
      .not('notes', 'like', 'Passage automatique%').not('answers', 'eq', '{}')
      .order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (answersRead.error) throw answersRead.error;
    const sameSample = JSON.stringify([...(answersRead.data?.sample_training_ids ?? [])].sort()) === JSON.stringify([...sampleIds].sort());
    const answers = sameSample ? answersRead.data?.answers ?? {} : {};
    const model = auditFocusModel(facts, answers, focusRead.data?.facts?.auditFocus ?? []);
    facts.auditFocus = model.focus;
    const { data: run, error: runError } = await supabase.from("audit_runs").insert({
      label: `Contrôle automatique du ${new Date().toLocaleDateString("fr-FR", { timeZone: 'Europe/Paris' })}`,
      finished_at: new Date().toISOString(),
      sample_training_ids: sampleIds,
      facts,
      answers,
      findings: issues,
      notes: "Passage automatique : contrôles sur les données seulement, sans les questions à l'auditeur.",
    }).select('id').single();

    // La trace du passage est la preuve attendue au titre de l'audit interne :
    // la perdre en silence viderait la tâche de son objet.
    if (runError || !run) {
      return createErrorResponse(`Enregistrement du passage impossible : ${runError?.message ?? 'aucun passage retourné'}`, 500);
    }

    // Les constats partent chez les administrateurs : ce sont eux qui portent
    // la conformité, et la table est lue par utilisateur.
    // daily_actions.user_id référence auth.users(id), que profiles porte dans
    // user_id et non dans id : les deux colonnes diffèrent sur chaque ligne.
    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_admin", true);
    if (adminsError) throw adminsError;
    const recipients = (admins ?? []).map((a) => a.user_id).filter(Boolean) as string[];

    const recipientEmail = await getSenderEmail();
    const owner = await supabase.from('profiles').select('user_id').eq('email', recipientEmail).maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.user_id) recipients.push(owner.data.user_id);
    for (const userId of new Set(recipients)) {
      const synced = await supabase.rpc('sync_daily_quality_actions', { _user_id: userId });
      if (synced.error) throw synced.error;
    }

    const summary = auditMailSummary(facts, answers);
    const lastSentSummary = sentRead.data?.facts ? auditMailSummary(sentRead.data.facts, sentRead.data.answers ?? {}) : null;
    const summaryChanged = JSON.stringify(summary) !== JSON.stringify(lastSentSummary);
    const changesSinceEmail = auditChanges(issues, sentRead.data?.findings ?? []);
    let emailSent = false;
    const changed = changesSinceEmail.changed || summaryChanged || !sentRead.data;
    if (shouldSendAuditSummary(changed, sentRead.data?.summary_email_sent_at)) {
      const rendered = await renderCatalogEmail(supabase, 'qualiopi_audit_focus', {
        vars: { focus_title: model.focus.length ? `indicateurs ${model.focus.join(' et ')}` : 'aucun indicateur à corriger' },
        blocks: { actions_list: renderAuditActions(model.actions), global_footer: `<p>Reste ${model.remaining} indicateur${model.remaining > 1 ? 's' : ''} à traiter${model.remaining ? ', prochain focus demain' : ''} · <a href="https://academy.supertilt.fr/audit-blanc">Audit blanc</a></p>`, signature: await getSigniticSignature() },
      });
      const sent = await sendEmail({ to: recipientEmail, bcc: (await getBccList()).filter(e => e !== recipientEmail), subject: rendered.subject, html: `<div style="text-align:left">${rendered.html}</div>`, _emailType: 'qualiopi_audit_summary', idempotencyKey: `qualiopi-audit-${run.id}` });
      const saved = await supabase.from('audit_runs').update({ summary_email_sent_at: sent.success ? new Date().toISOString() : null, summary_email_error: sent.error ?? null }).eq('id', run.id);
      if (saved.error) throw saved.error;
      if (!sent.success) throw new Error(`Envoi du bilan impossible : ${sent.error}`);
      emailSent = true;
    }
    console.log(`[${VERSION}] ${issues.length} constats, bilan envoyé : ${emailSent}`);

    return new Response(
      JSON.stringify({ success: true, issues: issues.length, actions: issues.length * new Set(recipients).size, emailSent, summary, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error(`[${VERSION}]`, error);
    return createErrorResponse(error instanceof Error ? error.message : "Audit failed", 500);
  }
});
