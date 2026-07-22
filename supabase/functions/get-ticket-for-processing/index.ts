// Endpoint dédié au workflow GitHub Actions pour récupérer un ticket support
// + ses pièces jointes (signed URLs). Auth via TICKET_STATUS_WEBHOOK_SECRET —
// évite d'avoir à exposer la service_role key côté GitHub (impossible sur
// Lovable Cloud).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, createErrorResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const sharedSecret = Deno.env.get("TICKET_STATUS_WEBHOOK_SECRET");
    if (!sharedSecret) {
      return createErrorResponse("Server misconfigured", 500, { fn: "get-ticket-for-processing" });
    }

    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    if (provided !== sharedSecret) {
      return createErrorResponse("Unauthorized", 401);
    }

    const url = new URL(req.url);
    const ticketNumber =
      url.searchParams.get("ticket_number") ||
      (req.method === "POST" ? (await req.json().catch(() => ({}))).ticket_number : null);

    if (!ticketNumber) {
      return createErrorResponse("ticket_number required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();

    if (ticketError) {
      return createErrorResponse(`DB error: ${ticketError.message}`, 500, {
        fn: "get-ticket-for-processing",
      });
    }
    if (!ticket) {
      return createErrorResponse("Not found", 404);
    }

    const { data: rawAttachments } = await supabase
      .from("support_ticket_attachments")
      .select("id, file_name, file_path, mime_type, file_size")
      .eq("ticket_id", ticket.id);

    const attachments = [] as Array<{
      file_name: string;
      mime_type: string | null;
      signed_url: string | null;
    }>;

    for (const a of rawAttachments ?? []) {
      const { data: signed } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(a.file_path, 60 * 60);
      attachments.push({
        file_name: a.file_name,
        mime_type: a.mime_type,
        signed_url: signed?.signedUrl ?? null,
      });
    }

    return new Response(
      JSON.stringify({ ticket, attachments }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("get-ticket-for-processing error:", err);
    return createErrorResponse(`Unexpected error: ${String(err)}`, 500, {
      fn: "get-ticket-for-processing",
      cause: err,
    });
  }
});
