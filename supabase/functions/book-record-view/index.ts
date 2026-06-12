import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => null);
    if (!body?.token) return createErrorResponse("token is required", 400);
    if (!body?.productionId) return createErrorResponse("productionId is required", 400);

    const token: string = body.token;
    const productionId: string = body.productionId;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve share link
    const { data: link, error: linkError } = await supabase
      .from("book_share_links")
      .select("id")
      .eq("token", token)
      .is("revoked_at", null)
      .single();

    if (linkError || !link) {
      return createErrorResponse("Share link not found or revoked", 404);
    }

    const { error: insertError } = await supabase
      .from("book_analytics_events")
      .insert({
        link_id: link.id,
        event_type: "production_view",
        production_id: productionId,
      });

    if (insertError) {
      console.error("[book-record-view] insert error:", insertError);
      return createErrorResponse(insertError.message, 500);
    }

    return createJsonResponse({ ok: true });
  } catch (err) {
    console.error("[book-record-view] Unexpected error:", err);
    return createErrorResponse("Internal error", 500);
  }
});
