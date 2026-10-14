import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createJsonResponse, createErrorResponse, handleCorsPreflightIfNeeded, getSupabaseClient, sendEmail, getSigniticSignature, getBccSettings, getAppUrls, formatDateFr } from "../_shared/mod.ts";
import { renderCatalogEmail, ctaButton, escapeEmailValue } from "../_shared/editable-email.ts";

/**
 * Daily: reminds clients who have not signed their rental contract.
 * Reminder #1 at J+3, #2 at J+7 after the contract email; max 2 per contract.
 * Extension amendments (location_extension_id) are excluded.
 * Each reminder is reserved by a conditional UPDATE so it is sent once.
 */
const VERSION = "send-location-signature-reminders@1.1.0";
const STEPS = [3, 7];
const DAY = 86_400_000;

serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;
  try {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const { data: rows, error } = await supabase
      .from("location_contract_signatures" as any)
      .select("id, token, recipient_email, recipient_name, game_name, contrat_reference, email_sent_at, expires_at, reminder_count")
      .eq("status", "pending")
      .is("location_extension_id", null)
      .lt("reminder_count", STEPS.length)
      .gt("expires_at", new Date().toISOString());
    if (error) throw error;

    const urls = await getAppUrls();
    const appUrl = (urls.app_url || "https://super-tools.lovable.app").replace(/\/+$/, "");
    const [signature, bcc] = await Promise.all([getSigniticSignature(), getBccSettings(supabase as any)]);
    const results: { id: string; status: string }[] = [];

    for (const r of (rows ?? []) as any[]) {
      const due = STEPS[r.reminder_count];
      if (!r.email_sent_at || now - new Date(r.email_sent_at).getTime() < due * DAY) continue;

      const { data: claimed } = await supabase
        .from("location_contract_signatures" as any)
        .update({ reminder_count: r.reminder_count + 1, last_reminder_at: new Date().toISOString() })
        .eq("id", r.id).eq("status", "pending").eq("reminder_count", r.reminder_count)
        .select("id");
      if (!claimed?.length) { results.push({ id: r.id, status: "already_claimed" }); continue; }

      const rendered = await renderCatalogEmail(supabase, "location_signature_reminder", {
        vars: {
          signer_name: r.recipient_name || "",
          game_name: r.game_name || "",
          contrat_reference: r.contrat_reference || "",
          expires_at: formatDateFr(r.expires_at),
        },
        blocks: { signature_button: ctaButton("✍️ Signer le contrat en ligne", `${appUrl}/signature-location/${escapeEmailValue(r.token)}`) },
      });
      const subject = rendered.subject.replace(/[ \t]+([,.!?])/g, "$1");
      const html = rendered.html.replace(/Bonjour ,/g, "Bonjour,");
      const res = await sendEmail({ to: r.recipient_email, bcc, subject, html: `${html}${signature}`, _emailType: "location_signature_reminder" } as any);
      if (!res.success) {
        await supabase.from("location_contract_signatures" as any)
          .update({ reminder_count: r.reminder_count }).eq("id", r.id);
        results.push({ id: r.id, status: "send_failed" });
      } else {
        await supabase.from("activity_logs").insert({
          action_type: "location_signature_reminder_sent",
          recipient_email: r.recipient_email,
          details: { contrat_reference: r.contrat_reference, reminder: r.reminder_count + 1 },
        } as any);
        results.push({ id: r.id, status: `sent_${r.reminder_count + 1}` });
      }
      await new Promise((ok) => setTimeout(ok, 400));
    }
    return createJsonResponse({ success: true, results, _version: VERSION });
  } catch (e) {
    console.error(VERSION, e);
    return createErrorResponse(e instanceof Error ? e.message : "error", 500);
  }
});
