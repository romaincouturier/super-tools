import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

/**
 * Weekly reconciliation job for the AI agent index.
 *
 * Filet de sécurité contre les triggers DB qui n'auraient pas tiré (oubli
 * de migration, désactivation accidentelle, schéma changé, etc.).
 *
 * Pour chaque source_type connu, compare les IDs présents dans la table
 * source vs ceux indexés dans `document_embeddings`. Tout ID manquant est
 * (re-)mis dans `indexation_queue`. Le cron `process-indexation-queue`
 * s'occupera de l'indexer dans les 2 minutes.
 *
 * Limite à RECONCILE_LIMIT par source pour éviter de saturer la queue.
 * Reporte un résumé Slack dans #general.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const RECONCILE_LIMIT = 200;

// source_type → table source (must match index-documents/index.ts)
const SOURCE_TABLES: Record<string, string> = {
  crm_card: "crm_cards",
  crm_comment: "crm_comments",
  crm_email: "crm_card_emails",
  inbound_email: "inbound_emails",
  training: "trainings",
  mission: "missions",
  mission_page: "mission_pages",
  mission_activity: "mission_activities",
  quote: "quotes",
  support_ticket: "support_tickets",
  coaching_summary: "coaching_summaries",
  evaluation_analysis: "evaluation_analyses",
  questionnaire_besoins: "questionnaire_besoins",
  okr_objective: "okr_objectives",
  okr_key_result: "okr_key_results",
  okr_initiative: "okr_initiatives",
  content_card: "content_cards",
  lms_lesson: "lms_lessons",
  crm_attachment: "crm_attachments",
  // activity_log : filtrage spécial (action_type='micro_devis_sent') — skipped
  // support_attachment : nested storage — skipped
};

async function postSlack(text: string, blocks: unknown[]) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const slackKey = Deno.env.get("SLACK_API_KEY");
  if (!lovableKey || !slackKey) return;

  let channel = "#general";
  try {
    const list = await fetch(`${GATEWAY_URL}/conversations.list?limit=200&types=public_channel`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": slackKey },
    });
    const data = await list.json();
    const match = data?.channels?.find((c: any) => c.name === "general");
    if (match?.id) channel = match.id;
  } catch (_) { /* fallback to name */ }

  await fetch(`${GATEWAY_URL}/chat.postMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": slackKey,
    },
    body: JSON.stringify({ channel, text, blocks, username: "Indexation IA", icon_emoji: ":mag:" }),
  });
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const summary: { source_type: string; in_source: number; indexed: number; missing: number; enqueued: number; error?: string }[] = [];
    let totalEnqueued = 0;

    for (const [sourceType, table] of Object.entries(SOURCE_TABLES)) {
      try {
        // Récupère les IDs en base source (limité aux N plus récents)
        const { data: sourceRows, error: srcErr } = await supabase
          .from(table)
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(2000);

        if (srcErr) {
          summary.push({ source_type: sourceType, in_source: 0, indexed: 0, missing: 0, enqueued: 0, error: srcErr.message });
          continue;
        }

        const sourceIds = new Set((sourceRows || []).map((r: any) => String(r.id)));
        if (sourceIds.size === 0) {
          summary.push({ source_type: sourceType, in_source: 0, indexed: 0, missing: 0, enqueued: 0 });
          continue;
        }

        // IDs déjà indexés
        const { data: indexedRows, error: idxErr } = await supabase
          .from("document_embeddings")
          .select("source_id")
          .eq("source_type", sourceType)
          .in("source_id", Array.from(sourceIds));

        if (idxErr) {
          summary.push({ source_type: sourceType, in_source: sourceIds.size, indexed: 0, missing: 0, enqueued: 0, error: idxErr.message });
          continue;
        }

        const indexedIds = new Set((indexedRows || []).map((r: any) => String(r.source_id)));
        const missing: string[] = [];
        for (const id of sourceIds) {
          if (!indexedIds.has(id)) missing.push(id);
          if (missing.length >= RECONCILE_LIMIT) break;
        }

        // Re-enqueue les manquants
        let enqueued = 0;
        if (missing.length > 0) {
          const rows = missing.map((id) => ({
            source_type: sourceType,
            source_id: id,
            operation: "upsert",
          }));
          const { error: insErr } = await supabase.from("indexation_queue").insert(rows);
          if (!insErr) enqueued = rows.length;
        }

        totalEnqueued += enqueued;
        summary.push({
          source_type: sourceType,
          in_source: sourceIds.size,
          indexed: indexedIds.size,
          missing: missing.length,
          enqueued,
        });
      } catch (e) {
        summary.push({
          source_type: sourceType,
          in_source: 0, indexed: 0, missing: 0, enqueued: 0,
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }

    // Slack notification (only if something was actually missing)
    if (totalEnqueued > 0) {
      const lines = summary
        .filter((s) => s.missing > 0)
        .sort((a, b) => b.missing - a.missing)
        .map((s) => `• ${s.source_type} : ${s.missing} manquant(s) → ${s.enqueued} ré-enfilé(s)`)
        .join("\n");

      await postSlack(
        `🔁 Réconciliation hebdo indexation : ${totalEnqueued} contenus ré-enfilés`,
        [
          { type: "header", text: { type: "plain_text", text: "🔁 Réconciliation indexation IA" } },
          { type: "section", text: { type: "mrkdwn", text: `*Total ré-enfilé :* ${totalEnqueued}\n\n${lines}` } },
          { type: "context", elements: [{ type: "mrkdwn", text: "Le cron process-indexation-queue les indexera dans les minutes qui viennent." }] },
        ],
      );
    }

    return createJsonResponse({ total_enqueued: totalEnqueued, summary });
  } catch (e) {
    return createErrorResponse(e instanceof Error ? e.message : "Unknown error");
  }
});
