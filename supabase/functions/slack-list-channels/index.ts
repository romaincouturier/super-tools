import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);
    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return createErrorResponse("LOVABLE_API_KEY is not configured", 500);
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      return createErrorResponse("SLACK_API_KEY is not configured", 500);
    }

    // Fetch all public channels with pagination
    const channels: { id: string; name: string; is_private: boolean; num_members: number }[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({
        types: "public_channel",
        exclude_archived: "true",
        limit: "200",
      });
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`${GATEWAY_URL}/conversations.list?${params}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": SLACK_API_KEY,
        },
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        console.error("Slack API error:", JSON.stringify(data));
        return createErrorResponse(`Slack error: ${data.error || response.status}`, 502);
      }

      for (const ch of data.channels || []) {
        channels.push({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private || false,
          num_members: ch.num_members || 0,
        });
      }

      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    // Sort by name
    channels.sort((a, b) => a.name.localeCompare(b.name));

    return createJsonResponse({ channels });
  } catch (error: unknown) {
    console.error("Error listing Slack channels:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(errorMessage);
  }
});
