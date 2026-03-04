import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
  createErrorResponse,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Check Daily Actions Completion (auto-detection)
 *
 * Called from the frontend when the dashboard loads.
 * Re-evaluates pending actions and auto-marks resolved ones.
 */

const VERSION = "check-daily-actions-completion@1.0.0";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const user = await verifyAuth(authHeader);
    if (!user) {
      return createErrorResponse("Non autorisé", 401);
    }

    const today = new Date().toISOString().split("T")[0];

    // Fetch uncompleted actions for today
    const { data: pendingActions, error: fetchError } = await supabase
      .from("daily_actions")
      .select("*")
      .eq("user_id", user.id)
      .eq("action_date", today)
      .eq("is_completed", false);

    if (fetchError) throw fetchError;
    if (!pendingActions || pendingActions.length === 0) {
      return createJsonResponse({ updated: 0, _version: VERSION });
    }

    // Group by entity type for batch checking
    const missionIds = pendingActions
      .filter((a) => a.entity_type === "mission")
      .map((a) => a.entity_id);

    const crmCardIds = pendingActions
      .filter((a) => a.entity_type === "crm_card")
      .map((a) => a.entity_id);

    const trainingIds = pendingActions
      .filter((a) => a.entity_type === "training")
      .map((a) => a.entity_id);

    const reviewIds = pendingActions
      .filter((a) => a.entity_type === "content_review")
      .map((a) => a.entity_id);

    // Fetch current states
    const [missionsResult, cardsResult, trainingsResult, reviewsResult] = await Promise.all([
      missionIds.length > 0
        ? supabase.from("missions").select("id, consumed_amount, billed_amount, status").in("id", missionIds)
        : { data: [] },
      crmCardIds.length > 0
        ? supabase.from("crm_cards").select("id, sales_status, column_id").in("id", crmCardIds)
        : { data: [] },
      trainingIds.length > 0
        ? supabase.from("trainings").select("id, convention_file_url, signed_convention_urls, invoice_file_url").in("id", trainingIds)
        : { data: [] },
      reviewIds.length > 0
        ? supabase.from("content_reviews").select("id, status").in("id", reviewIds)
        : { data: [] },
    ]);

    const missions = new Map((missionsResult.data || []).map((m: any) => [m.id, m]));
    const cards = new Map((cardsResult.data || []).map((c: any) => [c.id, c]));
    const trainingsMap = new Map((trainingsResult.data || []).map((t: any) => [t.id, t]));
    const reviews = new Map((reviewsResult.data || []).map((r: any) => [r.id, r]));

    // Also fetch CRM columns to check if cards moved
    const { data: crmColumns } = await supabase
      .from("crm_columns")
      .select("id, name, position")
      .eq("is_archived", false)
      .order("position", { ascending: true });

    const colList = crmColumns || [];
    const firstColId = colList.length > 0 ? colList[0].id : null;
    const contacteColId = colList.find((c: any) => c.name.toLowerCase().includes("contact"))?.id;
    const devisEnvoyeColId = colList.find((c: any) => c.name.toLowerCase().includes("devis envoy"))?.id;

    // Also fetch training participants for convention checks
    const trainIdsToCheck = pendingActions
      .filter((a) => a.entity_type === "training" && a.category === "formations_conventions")
      .map((a) => a.entity_id);

    let participantsByTraining = new Map<string, any[]>();
    if (trainIdsToCheck.length > 0) {
      const { data: participants } = await supabase
        .from("training_participants")
        .select("training_id, convention_file_url, signed_convention_url, payment_mode")
        .in("training_id", trainIdsToCheck);
      if (participants) {
        for (const p of participants) {
          const list = participantsByTraining.get(p.training_id) || [];
          list.push(p);
          participantsByTraining.set(p.training_id, list);
        }
      }
    }

    // Check each pending action
    const toComplete: string[] = [];
    const now = new Date().toISOString();

    for (const action of pendingActions) {
      let resolved = false;

      switch (action.category) {
        case "missions_a_facturer": {
          const m = missions.get(action.entity_id);
          if (m) {
            const consumed = Number(m.consumed_amount) || 0;
            const billed = Number(m.billed_amount) || 0;
            if (billed >= consumed || m.status === "cancelled") resolved = true;
          }
          break;
        }

        case "devis_a_faire": {
          const c = cards.get(action.entity_id);
          if (c) {
            if (c.sales_status !== "OPEN" || c.column_id !== contacteColId) resolved = true;
          } else {
            resolved = true; // card deleted
          }
          break;
        }

        case "opportunites": {
          const c = cards.get(action.entity_id);
          if (c) {
            if (c.sales_status !== "OPEN" || c.column_id !== firstColId) resolved = true;
          } else {
            resolved = true;
          }
          break;
        }

        case "devis_a_relancer": {
          const c = cards.get(action.entity_id);
          if (c) {
            if (c.sales_status !== "OPEN" || c.column_id !== devisEnvoyeColId) resolved = true;
          } else {
            resolved = true;
          }
          break;
        }

        case "formations_conventions": {
          const t = trainingsMap.get(action.entity_id);
          if (t) {
            const desc = action.description || "";
            if (desc.includes("non générée")) {
              // Check if convention is now generated
              if (t.convention_file_url) {
                resolved = true;
              } else {
                // Check participants for inter/e-learning
                const parts = participantsByTraining.get(action.entity_id) || [];
                const missingCount = parts.filter((p: any) => !p.convention_file_url && p.payment_mode !== "online").length;
                if (missingCount === 0) resolved = true;
              }
            } else if (desc.includes("non signée") || desc.includes("en attente")) {
              if (t.signed_convention_urls && t.signed_convention_urls.length > 0) {
                resolved = true;
              } else {
                const parts = participantsByTraining.get(action.entity_id) || [];
                const unsignedCount = parts.filter((p: any) =>
                  p.convention_file_url && !p.signed_convention_url && p.payment_mode !== "online"
                ).length;
                if (unsignedCount === 0) resolved = true;
              }
            }
          }
          break;
        }

        case "formations_facture": {
          const t = trainingsMap.get(action.entity_id);
          if (t && t.invoice_file_url) resolved = true;
          break;
        }

        case "articles_relire": {
          const r = reviews.get(action.entity_id);
          if (r && !["pending", "in_review"].includes(r.status)) resolved = true;
          if (!r) resolved = true; // review deleted
          break;
        }

        // Events and CFP: these are informational, don't auto-complete
        case "evenements":
        case "cfp_soumettre":
        case "cfp_surveiller":
          break;
      }

      if (resolved) {
        toComplete.push(action.id);
      }
    }

    // Batch update resolved actions
    let updated = 0;
    if (toComplete.length > 0) {
      const { error: updateError } = await supabase
        .from("daily_actions")
        .update({
          is_completed: true,
          completed_at: now,
          auto_completed: true,
        })
        .in("id", toComplete);

      if (updateError) {
        console.error(`[${VERSION}] Update error:`, updateError.message);
      } else {
        updated = toComplete.length;
      }
    }

    console.log(`[${VERSION}] Checked ${pendingActions.length} actions, auto-completed ${updated}`);

    return createJsonResponse({
      checked: pendingActions.length,
      updated,
      _version: VERSION,
    });
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(msg);
  }
});
