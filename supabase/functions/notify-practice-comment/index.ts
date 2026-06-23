import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSenderFrom, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { sendEmail } from "../_shared/resend.ts";
import { emailButton, wrapEmailHtml } from "../_shared/templates.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { learnerHasNotifEnabled } from "../_shared/learner-prefs.ts";

const VERSION = "notify-practice-comment@2026-06-23.1";

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
    const relativeLink = `/espace-apprenant/pratique?post=${encodeURIComponent(postId)}#post-${encodeURIComponent(postId)}`;
    const commentExcerpt = (comment?.content || "").slice(0, 280);
    const excerptHtml = commentExcerpt.replace(/\n/g, "<br>");

    // ── ST-2026-0206 : alerter TOUS les admins instantanement ──────────────────
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("is_admin", true);
    const adminEmails = (admins || [])
      .map((a: { email: string | null }) => (a.email || "").toLowerCase())
      .filter((e: string) => e && e !== commenter);
    let adminEmailSent = false;
    if (adminEmails.length > 0) {
      const adminHtml = wrapEmailHtml(`
        <p>Bonjour,</p>
        <p><strong>${commenterName}</strong> a posté un commentaire dans la communauté :</p>
        <blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:4px">
          ${excerptHtml}
        </blockquote>
        ${emailButton("Voir la discussion", link)}
      `, signature);
      const adminResult = await sendEmail({
        from: senderFrom,
        to: adminEmails,
        bcc: bccList,
        subject: `💬 Nouveau commentaire dans la communauté`,
        html: adminHtml,
        _emailType: "practice_comment_admin_notification",
      });
      adminEmailSent = !!adminResult.success;
    }

    // ── Notification in-app + email pour l'auteur de la publication ─────────────
    let ownerEmailSent = false;
    let inAppCreated = false;
    if (ownerEmail && ownerEmail !== commenter) {
      // In-app notification dans le centre de notifications apprenant.
      const { error: notifError } = await supabase
        .from("learner_notifications")
        .upsert(
          {
            learner_email: ownerEmail,
            type: "community_reply",
            title: "Nouveau commentaire",
            body: `${commenterName} a commenté votre publication.`,
            link: relativeLink,
            reference_id: commentId,
          },
          { onConflict: "learner_email,reference_id,type", ignoreDuplicates: true },
        );
      inAppCreated = !notifError;
      if (notifError) console.warn("learner_notifications insert failed:", notifError);

      // Email a l'auteur (respecte sa preference).
      const enabled = await learnerHasNotifEnabled(supabase, ownerEmail, "email_notif_work_comment");
      if (enabled) {
        const ownerHtml = wrapEmailHtml(`
          <p>Bonjour,</p>
          <p><strong>${commenterName}</strong> a commenté votre publication dans la communauté :</p>
          <blockquote style="border-left:3px solid #e5e7eb;padding:8px 16px;margin:16px 0;color:#374151;background:#f9fafb;border-radius:4px">
            ${excerptHtml}
          </blockquote>
          ${emailButton("Voir la discussion", link)}
          <p>À bientôt,<br>L'équipe SuperTilt</p>
        `, signature);
        const result = await sendEmail({
          from: senderFrom,
          to: [ownerEmail],
          bcc: bccList,
          subject: `💬 Nouveau commentaire sur votre publication`,
          html: ownerHtml,
          _emailType: "practice_comment_notification",
        });
        ownerEmailSent = !!result.success;
      }
    }

    return new Response(
      JSON.stringify({ success: true, adminEmailSent, ownerEmailSent, inAppCreated, _version: VERSION }),
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
