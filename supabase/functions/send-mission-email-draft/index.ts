/**
 * Send Mission Email Draft
 *
 * Sends an approved email draft from mission_email_drafts table.
 * Called when the comms manager approves a draft.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient, sendEmail, corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/mod.ts";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";

const VERSION = "send-mission-email-draft@1.0.0";

serve(async (req: Request) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const { draftId } = body;

    if (!draftId) {
      return new Response(
        JSON.stringify({ error: "Missing draftId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch draft
    const { data: draft, error: fetchError } = await supabase
      .from("mission_email_drafts")
      .select("*")
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      return new Response(
        JSON.stringify({ error: "Draft not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (draft.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Draft must be approved before sending", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderFrom = await getSenderFrom();
    const bccList = await getBccList();

    const result = await sendEmail({
      from: senderFrom,
      to: draft.contact_email,
      bcc: bccList,
      subject: draft.subject,
      html: draft.html_content,
      _emailType: `mission_${draft.email_type}`,
    });

    if (!result.success) {
      console.error(`[${VERSION}] sendEmail failed:`, result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Email sending failed", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as sent
    await supabase
      .from("mission_email_drafts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", draftId);

    // Check if all drafts for this mission + email_type are sent
    const { data: pendingDrafts } = await supabase
      .from("mission_email_drafts")
      .select("id")
      .eq("mission_id", draft.mission_id)
      .eq("email_type", draft.email_type)
      .in("status", ["pending", "approved"]);

    if (!pendingDrafts || pendingDrafts.length === 0) {
      // All drafts sent — update mission testimonial status
      const nextStatus = draft.email_type === "google_review" ? "google_review_sent" : "completed";
      await (supabase as any)
        .from("missions")
        .update({
          testimonial_status: nextStatus,
          testimonial_last_sent_at: new Date().toISOString(),
        })
        .eq("id", draft.mission_id);
      console.log(`[${VERSION}] All ${draft.email_type} drafts sent for mission ${draft.mission_id} → status: ${nextStatus}`);
    }

    return new Response(
      JSON.stringify({ success: true, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message, _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
