/**
 * Process Mission Testimonials
 *
 * Cron-triggered function that checks completed missions and creates
 * EMAIL DRAFTS for testimonial requests (requires comms manager validation).
 *
 * - Wait X days after mission end_date before creating drafts (configurable)
 * - Step 1: Create Google review request email drafts for all contacts
 * - Step 2: Y days later, create video testimonial request email drafts
 *
 * Drafts must be approved via the UI before being sent.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getSupabaseClient,
  getSigniticSignature,
  wrapEmailHtml,
  textToHtml,
  corsHeaders,
  handleCorsPreflightIfNeeded,
} from "../_shared/mod.ts";

serve(async (req: Request) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const supabase = getSupabaseClient();

    // Fetch settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "google_my_business_url",
        "supertilt_site_url",
        "delay_mission_google_review_days",
        "delay_mission_video_testimonial_days",
      ]);

    const getSetting = (key: string, fallback: string) =>
      settingsRows?.find((s: any) => s.setting_key === key)?.setting_value || fallback;

    const googleReviewUrl = getSetting("google_my_business_url", "");
    const siteUrl = getSetting("supertilt_site_url", "https://www.supertilt.fr");
    const delayGoogleReview = parseInt(getSetting("delay_mission_google_review_days", "2"), 10);
    const delayVideoTestimonial = parseInt(getSetting("delay_mission_video_testimonial_days", "4"), 10);

    // Get email signature
    let signature = "";
    try {
      signature = await getSigniticSignature();
    } catch (e) {
      console.warn("Could not fetch signature:", e);
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch missions needing testimonial processing
    const { data: missions, error } = await (supabase as any)
      .from("missions")
      .select("id, title, client_name, end_date, testimonial_status, testimonial_last_sent_at")
      .not("end_date", "is", null)
      .lte("end_date", todayStr)
      .neq("testimonial_status", "completed");

    if (error) {
      console.error("Error fetching missions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const missionsToProcess = (missions || []).filter((m: any) => m.end_date);

    if (missionsToProcess.length === 0) {
      return new Response(JSON.stringify({ message: "No missions to process" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let googleReviewDrafts = 0;
    let testimonialDrafts = 0;

    for (const mission of missionsToProcess) {
      const endDate = new Date(mission.end_date);
      const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch ALL contacts for this mission
      const { data: contacts } = await (supabase as any)
        .from("mission_contacts")
        .select("first_name, last_name, email, language")
        .eq("mission_id", mission.id);

      const validContacts = (contacts || []).filter((c: any) => c.email);
      if (validContacts.length === 0) continue;

      // STEP 1: Create Google Review drafts
      if (mission.testimonial_status === "pending" && daysSinceEnd >= delayGoogleReview) {
        // Check if drafts already exist for this mission + type
        const { data: existingDrafts } = await supabase
          .from("mission_email_drafts")
          .select("id")
          .eq("mission_id", mission.id)
          .eq("email_type", "google_review")
          .in("status", ["pending", "approved"]);

        if (existingDrafts && existingDrafts.length > 0) {
          console.log(`Mission ${mission.id}: google_review drafts already exist, skipping`);
          continue;
        }

        const { data: customTemplates } = await supabase
          .from("email_templates")
          .select("subject, html_content, template_type")
          .in("template_type", ["mission_google_review_tu", "mission_google_review_vous", "mission_google_review"]);

        const drafts: any[] = [];
        for (const contact of validContacts) {
          const clientName = contact.first_name || mission.client_name || "";
          const isFrench = contact.language === "fr" || !contact.language;

          const templateKey = "mission_google_review_vous";
          const customTemplate = customTemplates?.find((t: any) => t.template_type === templateKey)
            || customTemplates?.find((t: any) => t.template_type === "mission_google_review");

          let subject: string;
          let body: string;

          if (customTemplate) {
            subject = customTemplate.subject
              .replace(/\{\{mission_title\}\}/g, mission.title)
              .replace(/\{\{first_name\}\}/g, clientName);
            body = customTemplate.html_content
              .replace(/\{\{mission_title\}\}/g, mission.title)
              .replace(/\{\{first_name\}\}/g, clientName)
              .replace(/\{\{google_review_link\}\}/g, googleReviewUrl);
          } else {
            subject = isFrench
              ? `🌟 Votre avis sur notre collaboration "${mission.title}"`
              : `🌟 Your feedback on our collaboration "${mission.title}"`;

            const bodyText = isFrench
              ? `Bonjour${clientName ? ` ${clientName}` : ""},\n\nNotre collaboration sur "${mission.title}" touche à sa fin, et je tenais à vous remercier pour votre confiance.\n\nPour continuer à améliorer nos services, votre avis serait très précieux. Pourriez-vous nous accorder 1 minute pour laisser un commentaire sur notre page Google ?\n\n👉 Laisser un avis : ${googleReviewUrl || siteUrl}\n\nVotre retour est essentiel pour nous permettre de progresser.\n\nMerci infiniment pour votre soutien !\n\nÀ bientôt,`
              : `Hello${clientName ? ` ${clientName}` : ""},\n\nOur collaboration on "${mission.title}" is coming to an end. Could you spare 1 minute to leave a review on our Google page?\n\n👉 Leave a review: ${googleReviewUrl || siteUrl}\n\nThank you for your support!\n\nBest regards,`;

            body = textToHtml(bodyText);
          }

          const htmlContent = wrapEmailHtml(body, signature);
          drafts.push({
            mission_id: mission.id,
            email_type: "google_review",
            contact_email: contact.email,
            contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null,
            subject,
            html_content: htmlContent,
            status: "pending",
          });
        }

        if (drafts.length > 0) {
          const { error: insertError } = await supabase
            .from("mission_email_drafts")
            .insert(drafts);
          if (insertError) {
            console.error(`Error creating drafts for mission ${mission.id}:`, insertError.message);
          } else {
            // Move to intermediate status so we don't re-create drafts
            await (supabase as any)
              .from("missions")
              .update({ testimonial_status: "google_review_draft" })
              .eq("id", mission.id);
            googleReviewDrafts += drafts.length;
            console.log(`Created ${drafts.length} google_review drafts for mission ${mission.id}`);
          }
        }
      }

      // STEP 2: Create Video Testimonial drafts
      if (mission.testimonial_status === "google_review_sent" && mission.testimonial_last_sent_at) {
        const lastSent = new Date(mission.testimonial_last_sent_at);
        const daysSinceLastEmail = Math.floor((today.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastEmail >= delayVideoTestimonial) {
          const { data: existingDrafts } = await supabase
            .from("mission_email_drafts")
            .select("id")
            .eq("mission_id", mission.id)
            .eq("email_type", "video_testimonial")
            .in("status", ["pending", "approved"]);

          if (existingDrafts && existingDrafts.length > 0) continue;

          const { data: customTemplates } = await supabase
            .from("email_templates")
            .select("subject, html_content, template_type")
            .in("template_type", ["mission_video_testimonial_tu", "mission_video_testimonial_vous", "mission_video_testimonial"]);

          const drafts: any[] = [];
          for (const contact of validContacts) {
            const clientName = contact.first_name || mission.client_name || "";
            const isFrench = contact.language === "fr" || !contact.language;

            const templateKey = "mission_video_testimonial_vous";
            const customTemplate = customTemplates?.find((t: any) => t.template_type === templateKey)
              || customTemplates?.find((t: any) => t.template_type === "mission_video_testimonial");

            let subject: string;
            let body: string;

            if (customTemplate) {
              subject = customTemplate.subject
                .replace(/\{\{mission_title\}\}/g, mission.title)
                .replace(/\{\{first_name\}\}/g, clientName);
              body = customTemplate.html_content
                .replace(/\{\{mission_title\}\}/g, mission.title)
                .replace(/\{\{first_name\}\}/g, clientName)
                .replace(/\{\{site_url\}\}/g, siteUrl);
            } else {
              subject = isFrench
                ? `🎥 Partager votre expérience sur "${mission.title}"`
                : `🎥 Share your experience about "${mission.title}"`;

              const bodyText = isFrench
                ? `Bonjour${clientName ? ` ${clientName}` : ""},\n\nJe me permets de vous contacter pour vous proposer de partager votre retour d'expérience sur notre collaboration "${mission.title}".\n\nCe témoignage pourrait prendre la forme d'une courte interview en visioconférence (10 minutes maximum) ou d'un texte publié sur ${siteUrl}.\n\nSi vous êtes partant(e), répondez simplement à cet email.\n\nMerci d'avance !\n\nBonne journée,`
                : `Hello${clientName ? ` ${clientName}` : ""},\n\nI'm reaching out to invite you to share feedback about "${mission.title}".\n\nThis could be a short video call (10 min max) or written text published on ${siteUrl}.\n\nIf interested, simply reply to this email.\n\nThank you!\n\nBest regards,`;

              body = textToHtml(bodyText);
            }

            const htmlContent = wrapEmailHtml(body, signature);
            drafts.push({
              mission_id: mission.id,
              email_type: "video_testimonial",
              contact_email: contact.email,
              contact_name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || null,
              subject,
              html_content: htmlContent,
              status: "pending",
            });
          }

          if (drafts.length > 0) {
            const { error: insertError } = await supabase
              .from("mission_email_drafts")
              .insert(drafts);
            if (insertError) {
              console.error(`Error creating video testimonial drafts for mission ${mission.id}:`, insertError.message);
            } else {
              await (supabase as any)
                .from("missions")
                .update({ testimonial_status: "video_testimonial_draft" })
                .eq("id", mission.id);
              testimonialDrafts += drafts.length;
              console.log(`Created ${drafts.length} video_testimonial drafts for mission ${mission.id}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Mission testimonials processed",
        processed: missionsToProcess.length,
        googleReviewDrafts,
        testimonialDrafts,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing mission testimonials:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
