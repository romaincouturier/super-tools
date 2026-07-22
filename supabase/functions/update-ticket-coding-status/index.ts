// Edge function dédiée pour mettre à jour le statut de codage d'un ticket support
// depuis le workflow GitHub Actions. Authentification via shared secret dédié
// (TICKET_STATUS_WEBHOOK_SECRET) — indépendant de la service_role key pour éviter
// les pannes silencieuses lors des rotations.
// Redeploy: fix stale bundle (codingStatus ReferenceError) + coding_summary column.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, createErrorResponse } from "../_shared/cors.ts";
import { postTicketCodedToSlack } from "../_shared/support-slack.ts";

const ALLOWED_STATUSES = new Set(["queued", "running", "done", "error"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const sharedSecret = Deno.env.get("TICKET_STATUS_WEBHOOK_SECRET");
    if (!sharedSecret) {
      console.error("TICKET_STATUS_WEBHOOK_SECRET is not configured");
      return createErrorResponse("Server misconfigured: missing shared secret", 500, {
        fn: "update-ticket-coding-status",
      });
    }

    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (provided !== sharedSecret) {
      return createErrorResponse("Unauthorized", 401);
    }

    let body: {
      ticket_number?: string;
      coding_status?: string;
      coding_error?: string | null;
      status?: string;
      branch_url?: string | null;
      coding_summary?: string | null;
      resolution_notes?: string | null;
      discussion_requested_at?: string | null;
    } = {};
    try {
      body = await req.json();
    } catch {
      return createErrorResponse("Invalid JSON body", 400);
    }

    const ticketNumber = body.ticket_number?.trim();
    if (!ticketNumber) {
      return createErrorResponse("ticket_number is required", 400);
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    let codingStatus = "";
    if (body.coding_status !== undefined) {
      codingStatus = body.coding_status?.trim() ?? "";
      if (codingStatus && !ALLOWED_STATUSES.has(codingStatus)) {
        return createErrorResponse(
          `Invalid coding_status. Allowed: ${Array.from(ALLOWED_STATUSES).join(", ")}`,
          400,
        );
      }
      update.coding_status = codingStatus || null;
      update.coding_error = body.coding_error ?? null;
    }
    if (body.status !== undefined) update.status = body.status;
    if (body.branch_url !== undefined) update.branch_url = body.branch_url;
    if (body.coding_summary !== undefined) update.coding_summary = body.coding_summary;
    if (body.resolution_notes !== undefined) update.resolution_notes = body.resolution_notes;
    if (body.discussion_requested_at !== undefined) {
      update.discussion_requested_at = body.discussion_requested_at;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pour ne notifier Slack qu'une seule fois, à la transition vers "done".
    let previousCodingStatus: string | null = null;
    if (codingStatus === "done") {
      const { data: prev } = await supabase
        .from("support_tickets")
        .select("coding_status")
        .eq("ticket_number", ticketNumber)
        .maybeSingle();
      previousCodingStatus = prev?.coding_status ?? null;
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update(update)
      .eq("ticket_number", ticketNumber)
      .select("id, ticket_number, title, coding_status, branch_url")
      .maybeSingle();

    if (error) {
      console.error("Failed to update ticket:", error);
      return createErrorResponse(`Database update failed: ${error.message}`, 500, {
        fn: "update-ticket-coding-status",
      });
    }

    if (!data) {
      return createErrorResponse(`Ticket ${ticketNumber} not found`, 404);
    }

    // Notification Slack : uniquement à la transition vers "VIP codé" (coding done).
    if (codingStatus === "done" && previousCodingStatus !== "done") {
      await postTicketCodedToSlack(supabase, {
        ticket_number: data.ticket_number,
        title: data.title,
        branch_url: data.branch_url,
      });
    }

    console.log(`Ticket ${ticketNumber} → ${codingStatus}`);
    return new Response(
      JSON.stringify({ success: true, ticket: data }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return createErrorResponse(`Unexpected error: ${String(err)}`, 500, {
      fn: "update-ticket-coding-status",
      cause: err,
    });
  }
});
