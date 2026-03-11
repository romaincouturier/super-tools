/**
 * Process Mission Testimonials
 *
 * Cron-triggered function that checks completed missions and sends
 * testimonial request emails to ALL mission contacts:
 *
 * - Wait X days after mission end_date before sending (configurable via app_settings)
 * - Step 1: Send Google review request email to all contacts
 * - Step 2: Y days later, send video testimonial request email to all contacts
 *
 * Delays are read from app_settings:
 *   delay_mission_google_review_days (default: 2)
 *   delay_mission_video_testimonial_days (default: 4, days after google review)
 *
 * Email templates are read from email_templates table (mission_google_review / mission_video_testimonial)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getSupabaseClient,
  sendEmail,
  getSigniticSignature,
  wrapEmailHtml,
  textToHtml,
  corsHeaders,
  handleCorsPreflightIfNeeded,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";

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

    let googleReviewsSent = 0;
    let testimonialsSent = 0;
    const bccList = await getBccList();

    for (let mi = 0; mi < missionsToProcess.length; mi++) {
      const mission = missionsToProcess[mi];

      if (mi > 0) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      const endDate = new Date(mission.end_date);
      const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch ALL contacts for this mission (not just primary)
      const { data: contacts } = await (supabase as any)
        .from("mission_contacts")
        .select("first_name, last_name, email, language")
        .eq("mission_id", mission.id);

      const validContacts = (contacts || []).filter((c: any) => c.email);
      if (validContacts.length === 0) {
        console.log(`Mission ${mission.id}: no contacts with email, skipping`);
        continue;
      }

      // STEP 1: Send Google Review request
      if (mission.testimonial_status === "pending" && daysSinceEnd >= delayGoogleReview) {
        // Try custom template from email_templates (tu/vous variants)
        const { data: customTemplates } = await supabase
          .from("email_templates")
          .select("subject, html_content, template_type")
          .in("template_type", ["mission_google_review_tu", "mission_google_review_vous", "mission_google_review"]);

        let allSent = true;
        for (let ci = 0; ci < validContacts.length; ci++) {
          const contact = validContacts[ci];
          if (ci > 0) await new Promise(r => setTimeout(r, 400));

          const clientName = contact.first_name || mission.client_name || "";
          const isFrench = contact.language === "fr" || !contact.language;

          // Determine tu/vous — default to vous
          const addressMode = "vous";
          const templateKey = `mission_google_review_${addressMode}`;
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
              ? `Bonjour${clientName ? ` ${clientName}` : ""},

Notre collaboration sur "${mission.title}" touche à sa fin, et je tenais à vous remercier pour votre confiance.

Pour continuer à améliorer nos services et partager des retours d'expérience, votre avis serait très précieux. Pourriez-vous nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Laisser un avis : ${googleReviewUrl || siteUrl}

Votre retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos services.

Merci infiniment pour votre soutien !

À bientôt,`
              : `Hello${clientName ? ` ${clientName}` : ""},

Our collaboration on "${mission.title}" is coming to an end, and I wanted to thank you for your trust.

To continue improving our services, your feedback would be invaluable. Could you spare 1 minute to leave a review on our Google page?

👉 Leave a review: ${googleReviewUrl || siteUrl}

Your feedback is essential in helping us grow and helping other organizations discover our services.

Thank you for your support!

Best regards,`;

            body = textToHtml(bodyText);
          }

          const html = wrapEmailHtml(body, signature);
          const result = await sendEmail({
            to: contact.email,
            bcc: ci === 0 ? bccList : undefined, // BCC only on first contact
            subject,
            html,
            _emailType: "mission_google_review",
          });

          if (!result.success) {
            console.error(`Failed to send google review email to ${contact.email} for mission ${mission.id}:`, result.error);
            allSent = false;
          }
        }

        if (allSent) {
          await (supabase as any)
            .from("missions")
            .update({
              testimonial_status: "google_review_sent",
              testimonial_last_sent_at: new Date().toISOString(),
            })
            .eq("id", mission.id);

          googleReviewsSent++;
          console.log(`Google review emails sent for mission ${mission.id} (${validContacts.length} contacts)`);
        }
      }

      // STEP 2: Send Video Testimonial request
      if (mission.testimonial_status === "google_review_sent" && mission.testimonial_last_sent_at) {
        const lastSent = new Date(mission.testimonial_last_sent_at);
        const daysSinceLastEmail = Math.floor((today.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastEmail >= delayVideoTestimonial) {
          const { data: customTemplates } = await supabase
            .from("email_templates")
            .select("subject, html_content, template_type")
            .in("template_type", ["mission_video_testimonial_tu", "mission_video_testimonial_vous", "mission_video_testimonial"]);

          let allSent = true;
          for (let ci = 0; ci < validContacts.length; ci++) {
            const contact = validContacts[ci];
            if (ci > 0) await new Promise(r => setTimeout(r, 400));

            const clientName = contact.first_name || mission.client_name || "";
            const isFrench = contact.language === "fr" || !contact.language;

            const addressMode = "vous";
            const templateKey = `mission_video_testimonial_${addressMode}`;
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
                ? `Bonjour${clientName ? ` ${clientName}` : ""},

Je me permets de vous contacter pour vous proposer de partager votre retour d'expérience sur notre collaboration "${mission.title}".

Ce témoignage pourrait prendre la forme d'une courte interview en visioconférence (10 minutes maximum) ou d'un texte qui sera publié sur ${siteUrl}.

Votre retour serait précieux pour inspirer d'autres organisations et valoriser votre analyse.

Si vous êtes partant(e), répondez simplement à cet email pour que nous puissions convenir d'un moment ensemble.

Merci d'avance pour votre temps !

Bonne journée,`
                : `Hello${clientName ? ` ${clientName}` : ""},

I'm reaching out to invite you to share your feedback about our collaboration on "${mission.title}".

This testimonial could be a short video call interview (10 minutes max) or a written text that will be published on ${siteUrl}.

Your feedback would be invaluable in inspiring other organizations.

If you're interested, simply reply to this email so we can find a convenient time.

Thank you for your time!

Best regards,`;

              body = textToHtml(bodyText);
            }

            const html = wrapEmailHtml(body, signature);
            const result = await sendEmail({
              to: contact.email,
              bcc: ci === 0 ? bccList : undefined,
              subject,
              html,
              _emailType: "mission_video_testimonial",
            });

            if (!result.success) {
              console.error(`Failed to send testimonial email to ${contact.email} for mission ${mission.id}:`, result.error);
              allSent = false;
            }
          }

          if (allSent) {
            await (supabase as any)
              .from("missions")
              .update({
                testimonial_status: "completed",
                testimonial_last_sent_at: new Date().toISOString(),
              })
              .eq("id", mission.id);

            testimonialsSent++;
            console.log(`Video testimonial emails sent for mission ${mission.id} (${validContacts.length} contacts)`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Mission testimonials processed",
        processed: missionsToProcess.length,
        googleReviewsSent,
        testimonialsSent,
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
