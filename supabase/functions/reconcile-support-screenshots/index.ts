import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const VERSION = "reconcile-support-screenshots@2026-05-07.1";

serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const supabase = getSupabaseClient();

    // 1. Tickets où screenshot_url est NULL
    const { data: tickets, error: ticketsErr } = await supabase
      .from("support_tickets")
      .select("id, ticket_number")
      .is("screenshot_url", null);

    if (ticketsErr) throw ticketsErr;
    if (!tickets || tickets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, scanned: 0, updated: 0, skipped: 0, _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ticketIds = tickets.map((t) => t.id);

    // 2. Pour chaque ticket, première pièce jointe image/*
    const { data: attachments, error: attErr } = await supabase
      .from("support_ticket_attachments")
      .select("ticket_id, file_path, mime_type, created_at")
      .in("ticket_id", ticketIds)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true });

    if (attErr) throw attErr;

    // Regrouper : première (la plus ancienne) pièce jointe image par ticket
    const firstByTicket = new Map<string, string>();
    for (const a of attachments ?? []) {
      if (!firstByTicket.has(a.ticket_id)) {
        firstByTicket.set(a.ticket_id, a.file_path);
      }
    }

    let updated = 0;
    let skipped = 0;
    const failures: Array<{ ticket_number: string; error: string }> = [];

    for (const ticket of tickets) {
      const filePath = firstByTicket.get(ticket.id);
      if (!filePath) {
        skipped++;
        continue;
      }
      const { data: pub } = supabase.storage
        .from("support-attachments")
        .getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        failures.push({ ticket_number: ticket.ticket_number, error: "no_public_url" });
        continue;
      }

      // Idempotent : on ne met à jour que si screenshot_url IS NULL
      const { error: updErr, count } = await supabase
        .from("support_tickets")
        .update({ screenshot_url: publicUrl }, { count: "exact" })
        .eq("id", ticket.id)
        .is("screenshot_url", null);

      if (updErr) {
        failures.push({ ticket_number: ticket.ticket_number, error: updErr.message });
        continue;
      }
      if ((count ?? 0) > 0) {
        updated++;
        console.log(`[${VERSION}] updated ${ticket.ticket_number} -> ${publicUrl}`);
      } else {
        skipped++;
      }
    }

    console.log(
      `[${VERSION}] scanned=${tickets.length} updated=${updated} skipped=${skipped} failures=${failures.length}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        scanned: tickets.length,
        updated,
        skipped,
        failures,
        _version: VERSION,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("reconcile-support-screenshots error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
