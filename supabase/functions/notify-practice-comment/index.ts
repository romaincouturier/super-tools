import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { learnerHasNotifEnabled } from "../_shared/learner-prefs.ts";

const VERSION = "notify-practice-comment@2026-05-26.1";

/**
 * Notify the author of a practice (community) post when a new comment is added.
 *
 * Body: { postId: string, commentId: string, commenterEmail: string }
 *
 * - Looks up the post owner.
 * - Skips if commenter is the same as the post owner.
 * - Respects the learner preference `email_notif_work_comment`.
 */
serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const { postId, commentId, commenterEmail } = await req.json().catch(() => ({}));
    if (!postId || !commentId) {
      return new Response(
        JSON.stringify({ error: "Missing postId or commentId", _version: VERSION }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load post + comment
    const { data: post } = await supabase
      .from("practice_posts")
      .select("id, author_email, content")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found", _version: VERSION }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ownerEmail = (post.author_email || "").toLowerCase();
    const commenter = (commenterEmail || "").toLowerCase();
    if (!ownerEmail || ownerEmail === commenter) {
      return new Response(
        JSON.stringify({ success: true, skipped: "self_or_no_owner", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const enabled = await learnerHasNotifEnabled(supabase, ownerEmail, "email_notif_work_comment");
    if (!enabled) {
      return new Response(
        JSON.stringify({ success: true, skipped: "pref_off", _version: VERSION }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: comment } = await supabase
      .from("practice_post_comments")
      .select("content")
      .eq("id", commentId)
      .maybeSingle();

    const { data: commenterProfile } = await supabase
      .from("learner_profiles")
      .select("first_name, last_name")
      .eq("email", commenter)
      .maybeSingle();
    const commenterName = [commenterProfile?.first_name, commenterProfile?.last_name]
      .filter(Boolean).join(" ").trim() || commenter;

    const senderFrom = await getSenderFrom();
    const signature = await getSigniticSignature();
    const bccList = await getBccList();
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const link = `${urls.app_url}/espace-apprenant/pratique?post=${encodeURIComponent(postId)}#post-${encodeURIComponent(postId)}`;

    const subject = `💬 Nouveau commentaire sur votre publication`;
    const commentExcerpt = (comment?.content || "").slice(0, 280);
    const bodyHtml = `
      <p>Bonjour,</p>
      <p><strong>${commenterName}</strong> a commenté votre publication dans la communauté :</p>
      <blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:4px">
        ${commentExcerpt.replace(/\n/g, "<br>")}
      </blockquote>
      ${emailButton("Voir la discussion", link)}
      <p>À bientôt,<br>L'équipe SuperTilt</p>
    `;
    const html = wrapEmailHtml(bodyHtml, signature);

    const result = await sendEmail({
      from: senderFrom,
      to: [ownerEmail],
      bcc: bccList,
      subject,
      html,
      _emailType: "practice_comment_notification",
    });

    return new Response(
      JSON.stringify({ success: !!result.success, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-practice-comment error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error", _version: VERSION }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
