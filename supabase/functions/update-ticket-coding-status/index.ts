// Edge function dédiée pour mettre à jour le statut de codage d'un ticket support
// depuis le workflow GitHub Actions. Authentification via shared secret dédié
// (TICKET_STATUS_WEBHOOK_SECRET) — indépendant de la service_role key pour éviter
// les pannes silencieuses lors des rotations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

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
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing shared secret" }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (provided !== sharedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    let body: {
      ticket_number?: string;
      coding_status?: string;
      coding_error?: string | null;
    } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const ticketNumber = body.ticket_number?.trim();
    const codingStatus = body.coding_status?.trim();

    if (!ticketNumber || !codingStatus) {
      return new Response(
        JSON.stringify({ error: "ticket_number and coding_status are required" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    if (!ALLOWED_STATUSES.has(codingStatus)) {
      return new Response(
        JSON.stringify({
          error: `Invalid coding_status. Allowed: ${Array.from(ALLOWED_STATUSES).join(", ")}`,
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update: Record<string, unknown> = {
      coding_status: codingStatus,
      coding_error: body.coding_error ?? null,
    };

    const { data, error } = await supabase
      .from("support_tickets")
      .update(update)
      .eq("ticket_number", ticketNumber)
      .select("id, ticket_number, coding_status")
      .maybeSingle();

    if (error) {
      console.error("Failed to update ticket:", error);
      return new Response(
        JSON.stringify({ error: "Database update failed", details: error.message }),
        { status: 500, headers: jsonHeaders },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: `Ticket ${ticketNumber} not found` }),
        { status: 404, headers: jsonHeaders },
      );
    }

    console.log(`Ticket ${ticketNumber} → ${codingStatus}`);
    return new Response(
      JSON.stringify({ success: true, ticket: data }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
