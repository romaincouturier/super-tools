/**
 * Process Mission Testimonials
 *
 * Cron-triggered function that checks completed missions and sends
 * testimonial request emails to clients:
 *
 * - Wait 2 days after mission end_date before sending anything
 * - Step 1: Send Google review request email
 * - Step 2: 2 days later, send video testimonial request email
 *
 * Designed to be called by a cron job (daily at 7AM like process-logistics-reminders)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const DAYS_BEFORE_GOOGLE_REVIEW = 2;
const DAYS_BETWEEN_EMAILS = 2;

serve(async (req: Request) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const supabase = getSupabaseClient();

    // Fetch google_my_business_url from settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["google_my_business_url", "supertilt_site_url"]);

    const googleReviewUrl = settings?.find((s: any) => s.setting_key === "google_my_business_url")?.setting_value || "";
    const siteUrl = settings?.find((s: any) => s.setting_key === "supertilt_site_url")?.setting_value || "https://www.supertilt.fr";

    // Get email signature
    let signature = "";
    try {
      signature = await getSigniticSignature();
    } catch (e) {
      console.warn("Could not fetch signature:", e);
    }

    // Find missions needing testimonial processing:
    // - end_date is set and in the past
    // - client_contact is set (contains name + email)
    // - testimonial_status is not 'completed'
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch missions that need testimonial processing
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

    // Helper: extract email from client_contact string (e.g. "Jean Dupont jean@example.com")
    const extractEmail = (contact: string): string | null => {
      const match = contact.match(/[\w.+-]+@[\w.-]+\.\w+/);
      return match ? match[0] : null;
    };

    // Helper: extract name from client_contact (everything before the email)
    const extractName = (contact: string): string => {
      const email = extractEmail(contact);
      if (!email) return contact.trim();
      return contact.replace(email, "").trim();
    };

    // Filter missions - we'll use mission_contacts instead of client_contact field
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

    for (let mi = 0; mi < missionsWithEmail.length; mi++) {
      const mission = missionsWithEmail[mi];

      // Rate limit between missions
      if (mi > 0) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const endDate = new Date(mission.end_date);
      const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch primary contact from mission_contacts
      const { data: contacts } = await (supabase as any)
        .from("mission_contacts")
        .select("first_name, last_name, email, language")
        .eq("mission_id", mission.id)
        .eq("is_primary", true)
        .limit(1);

      const primaryContact = contacts?.[0];
      if (!primaryContact || !primaryContact.email) {
        console.log(`Mission ${mission.id}: no primary contact with email, skipping`);
        continue;
      }

      const clientName = primaryContact.first_name || mission.client_name || "";
      const clientEmail = primaryContact.email;

      // Determine language from primary contact
      const isFrench = primaryContact.language === "fr" || !primaryContact.language;

      // STEP 1: Send Google Review request
      if (mission.testimonial_status === "pending" && daysSinceEnd >= DAYS_BEFORE_GOOGLE_REVIEW) {
        // Try to get custom template from email_templates
        const { data: customTemplate } = await supabase
          .from("email_templates")
          .select("subject, html_content")
          .eq("template_type", "mission_google_review")
          .maybeSingle();

        let subject: string;
        let body: string;

        if (customTemplate) {
          subject = customTemplate.subject.replace(/\{\{mission_title\}\}/g, mission.title).replace(/\{\{first_name\}\}/g, clientName);
          body = customTemplate.html_content.replace(/\{\{mission_title\}\}/g, mission.title).replace(/\{\{first_name\}\}/g, clientName).replace(/\{\{google_review_link\}\}/g, googleReviewUrl);
        } else {
          // Default template
          subject = `🌟 Votre avis sur notre collaboration "${mission.title}"`;
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
          to: clientEmail,
          bcc: bccList,
          subject,
          html,
          _emailType: "mission_google_review",
        });

        if (result.success) {
          await (supabase as any)
            .from("missions")
            .update({
              testimonial_status: "google_review_sent",
              testimonial_last_sent_at: new Date().toISOString(),
            })
            .eq("id", mission.id);

          googleReviewsSent++;
          console.log(`Google review email sent for mission ${mission.id}`);
        } else {
          console.error(`Failed to send google review email for mission ${mission.id}:`, result.error);
        }
      }

      // STEP 2: Send Video Testimonial request (2 days after Google review)
      if (mission.testimonial_status === "google_review_sent" && mission.testimonial_last_sent_at) {
        const lastSent = new Date(mission.testimonial_last_sent_at);
        const daysSinceLastEmail = Math.floor((today.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastEmail >= DAYS_BETWEEN_EMAILS) {
          const { data: customTemplate } = await supabase
            .from("email_templates")
            .select("subject, html_content")
            .eq("template_type", "mission_video_testimonial")
            .maybeSingle();

          let subject: string;
          let body: string;

          if (customTemplate) {
            subject = customTemplate.subject.replace(/\{\{mission_title\}\}/g, mission.title).replace(/\{\{first_name\}\}/g, clientName);
            body = customTemplate.html_content.replace(/\{\{mission_title\}\}/g, mission.title).replace(/\{\{first_name\}\}/g, clientName);
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
            to: clientEmail,
            bcc: bccList,
            subject,
            html,
            _emailType: "mission_video_testimonial",
          });

          if (result.success) {
            await (supabase as any)
              .from("missions")
              .update({
                testimonial_status: "completed",
                testimonial_last_sent_at: new Date().toISOString(),
              })
              .eq("id", mission.id);

            testimonialsSent++;
            console.log(`Video testimonial email sent for mission ${mission.id}`);
          } else {
            console.error(`Failed to send testimonial email for mission ${mission.id}:`, result.error);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Mission testimonials processed",
        processed: missionsWithEmail.length,
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
