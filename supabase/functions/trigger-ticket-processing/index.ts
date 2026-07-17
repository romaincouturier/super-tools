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

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    // Verify the caller is an authenticated staff member
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    if (!GITHUB_TOKEN) {
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
      return createErrorResponse(`GitHub API error ${response.status}`, 502, {
        fn: "trigger-ticket-processing",
        cause: new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`),
      });
    }

    return createJsonResponse({ ok: true, ticket_number });
  } catch (err) {
    console.error("[trigger-ticket-processing]", err);
    return createErrorResponse("Erreur interne", 500, {
      fn: "trigger-ticket-processing",
      cause: err,
    });
  }
});
