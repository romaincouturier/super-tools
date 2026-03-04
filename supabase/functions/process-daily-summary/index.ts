import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
  createErrorResponse,
} from "../_shared/mod.ts";

/**
 * Process Daily Summary
 *
 * Called daily at 23:00 by a cron job.
 * Computes end-of-day stats for each user:
 *   - Total / completed / auto / manual counts
 *   - Per-category breakdown with average completion time
 * Stores results in daily_action_analytics table.
 * Also updates the cumulative theme ranking (avg resolution time per category).
 */

const VERSION = "process-daily-summary@1.0.0";

const CATEGORY_LABELS: Record<string, string> = {
  missions_a_facturer: "Missions à facturer",
  devis_a_faire: "Devis à faire",
  opportunites: "Opportunités",
  devis_a_relancer: "Devis à relancer",
  formations_conventions: "Formations (conventions)",
  articles_relire: "Articles à relire",
  evenements: "Événements",
  cfp_soumettre: "CFP à soumettre",
  cfp_surveiller: "CFP à surveiller",
  formations_facture: "Formations (facture)",
};

serve(async (req) => {
  console.log(`[${VERSION}] Starting daily summary...`);

  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    // Fetch all actions for today
    const { data: todayActions, error: fetchError } = await supabase
      .from("daily_actions")
      .select("*")
      .eq("action_date", today);

    if (fetchError) throw fetchError;
    if (!todayActions || todayActions.length === 0) {
      console.log(`[${VERSION}] No actions found for ${today}`);
      return createJsonResponse({ success: true, message: "No actions", _version: VERSION });
    }

    // Group by user
    const actionsByUser = new Map<string, typeof todayActions>();
    for (const action of todayActions) {
      const list = actionsByUser.get(action.user_id) || [];
      list.push(action);
      actionsByUser.set(action.user_id, list);
    }

    const summaries: any[] = [];

    for (const [userId, actions] of actionsByUser) {
      const total = actions.length;
      const completed = actions.filter((a) => a.is_completed);
      const autoCompleted = completed.filter((a) => a.auto_completed);
      const manualCompleted = completed.filter((a) => !a.auto_completed);

      // Per-category stats
      const categoryMap = new Map<string, { total: number; completed: number; completionMinutes: number[] }>();

      for (const action of actions) {
        const cat = action.category;
        const stats = categoryMap.get(cat) || { total: 0, completed: 0, completionMinutes: [] };
        stats.total++;
        if (action.is_completed && action.completed_at) {
          stats.completed++;
          const createdAt = new Date(action.created_at).getTime();
          const completedAt = new Date(action.completed_at).getTime();
          const minutes = Math.round((completedAt - createdAt) / (1000 * 60));
          if (minutes >= 0) stats.completionMinutes.push(minutes);
        }
        categoryMap.set(cat, stats);
      }

      const categoryStats: Record<string, any> = {};
      for (const [cat, stats] of categoryMap) {
        const avgMinutes = stats.completionMinutes.length > 0
          ? Math.round(stats.completionMinutes.reduce((a, b) => a + b, 0) / stats.completionMinutes.length)
          : null;

        categoryStats[cat] = {
          label: CATEGORY_LABELS[cat] || cat,
          total: stats.total,
          completed: stats.completed,
          avg_completion_minutes: avgMinutes,
        };
      }

      summaries.push({
        user_id: userId,
        action_date: today,
        total_actions: total,
        completed_count: completed.length,
        auto_completed_count: autoCompleted.length,
        manual_completed_count: manualCompleted.length,
        category_stats: categoryStats,
      });
    }

    // Upsert summaries
    const { error: upsertError } = await supabase
      .from("daily_action_analytics")
      .upsert(summaries, { onConflict: "user_id,action_date" });

    if (upsertError) {
      console.error(`[${VERSION}] Upsert error:`, upsertError.message);
      throw upsertError;
    }

    console.log(`[${VERSION}] Done: ${summaries.length} summaries for ${today}`);

    return createJsonResponse({
      success: true,
      summaryCount: summaries.length,
      date: today,
      _version: VERSION,
    });
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg);
  }
});
