import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getSenderFrom } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

/**
 * Notify users when they are tagged on a watch item.
 * Body: { watchItemId: string, watchItemTitle: string, newlyTaggedUserIds: string[] }
 * Fetches the emails of the newly tagged users from `profiles` and sends a
 * short email linking back to the veille module.
 */
serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { watchItemId, watchItemTitle, newlyTaggedUserIds } = await req.json() as {
      watchItemId?: string;
      watchItemTitle?: string;
      newlyTaggedUserIds?: string[];
    };

    if (!watchItemId || !Array.isArray(newlyTaggedUserIds) || newlyTaggedUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nothing to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabase = getSupabaseClient();

    const [profilesRes, senderFrom, signature, { getAppUrls }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, first_name, email")
        .in("user_id", newlyTaggedUserIds),
      getSenderFrom(),
      getSigniticSignature(),
      import("../_shared/app-urls.ts"),
    ]);

    if (profilesRes.error) throw new Error("Failed to fetch profiles");
    const profiles = (profilesRes.data ?? []) as { user_id: string; first_name: string | null; email: string }[];
    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No profiles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const urls = await getAppUrls();
    const watchUrl = `${urls.app_url}/veille?item=${watchItemId}`;
    const displayTitle = watchItemTitle?.trim() || "un élément de veille";

    let sent = 0;
    let errors = 0;
    for (const p of profiles) {
      const greeting = p.first_name ? `Bonjour ${p.first_name},` : "Bonjour,";
      const htmlBody = `
        <p>${greeting}</p>
        <p>Tu as été tagué(e) sur un élément de veille : <strong>${escapeHtml(displayTitle)}</strong>.</p>
        <p><a href="${watchUrl}">Voir la carte dans SuperTools →</a></p>
      `;
      const result = await sendEmail({
        from: senderFrom,
        to: [p.email],
        subject: `Tu es tagué sur « ${displayTitle} »`,
        html: `${htmlBody}\n${signature}`,
        _emailType: "watch_tag_notification",
      });
      if (result.success) {
        sent += 1;
        try {
          await supabase.from("activity_logs").insert({
            action_type: "watch_tag_notification_sent",
            recipient_email: p.email,
            details: {
              watch_item_id: watchItemId,
              watch_item_title: displayTitle,
            },
          });
        } catch (err) {
          console.error("Failed to log activity:", err);
        }
      } else {
        errors += 1;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, total: profiles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error in notify-watch-tag:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
