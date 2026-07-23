import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "../_shared/cors.ts";

const GITHUB_TOKEN = Deno.env.get("GH_DISPATCH_TOKEN")!;
const GITHUB_OWNER = "romaincouturier";
const GITHUB_REPO = "super-tools";
const WORKFLOW_ID = "process-ticket.yml";

// deno-lint-ignore no-explicit-any
async function markCodingError(supabase: any, ticketNumber: string, message: string): Promise<void> {
  try {
    await supabase
      .from("support_tickets")
      .update({ coding_status: "error", coding_error: message })
      .eq("ticket_number", ticketNumber);
  } catch (e) {
    console.error("[trigger-ticket-processing] markCodingError failed:", e);
  }
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  let ticketNumber: string | null = null;
  // deno-lint-ignore no-explicit-any
  let serviceClient: any = null;

  try {
    // Verify the caller is an authenticated staff member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    serviceClient = supabase;

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return createErrorResponse("Unauthorized", 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return createErrorResponse("Forbidden: staff only", 403);

    const { ticket_number } = await req.json();
    if (!ticket_number || typeof ticket_number !== "string") {
      return createErrorResponse("ticket_number requis", 400);
    }
    ticketNumber = ticket_number;

    // Interrupteur global : le codage auto peut être débrayé depuis le kanban.
    const { data: autoCoding } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "auto_coding_enabled")
      .maybeSingle();
    if (autoCoding?.setting_value === "false") {
      await supabase
        .from("support_tickets")
        .update({ coding_status: null, coding_error: null })
        .eq("ticket_number", ticket_number);
      return createJsonResponse({ ok: false, skipped: "auto_coding_disabled", ticket_number });
    }

    if (!GITHUB_TOKEN) {
      await markCodingError(supabase, ticket_number, "GH_DISPATCH_TOKEN non configuré côté Supabase");
      return createErrorResponse("GH_DISPATCH_TOKEN non configuré", 500, {
        fn: "trigger-ticket-processing",
      });
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { ticket_number },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("[trigger-ticket-processing] GitHub API error:", response.status, body);
      await markCodingError(supabase, ticket_number, `Dispatch GitHub refusé (HTTP ${response.status})`);
      return createErrorResponse(`GitHub API error ${response.status}`, 502, {
        fn: "trigger-ticket-processing",
        cause: new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`),
      });
    }

    return createJsonResponse({ ok: true, ticket_number });
  } catch (err) {
    console.error("[trigger-ticket-processing]", err);
    if (serviceClient && ticketNumber) {
      await markCodingError(serviceClient, ticketNumber, "Erreur interne au déclenchement du workflow");
    }
    return createErrorResponse("Erreur interne", 500, {
      fn: "trigger-ticket-processing",
      cause: err,
    });
  }
});
