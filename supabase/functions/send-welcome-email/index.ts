import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  replaceVariables,
  getSupabaseClient,
  sendEmail,
  escapeHtml,
} from "../_shared/mod.ts";
import { processTemplate } from "../_shared/templates.ts";

// Send notification to sponsor (intra-enterprise)
async function sendSponsorNotification(
  sponsorEmail: string,
  sponsorFirstName: string | null,
  sponsorFormalAddress: boolean,
  trainingName: string,
  participantsList: string[],
  signature: string,
  bccList: string[],
  supabase: any,
): Promise<void> {
  const participantsFormatted = participantsList.map(p => `<li>${escapeHtml(p)}</li>`).join('');

  // Try template
  const suffix = sponsorFormalAddress ? "vous" : "tu";
  const { data: template } = await supabase
    .from("email_templates")
    .select("subject, html_content")
    .eq("template_type", `sponsor_notification_${suffix}`)
    .maybeSingle();

  let subject: string;
  let htmlContent: string;

  if (template) {
    const vars = {
      first_name: sponsorFirstName || "",
      training_name: trainingName,
      participants_list: `<ul style="margin-left: 20px;">${participantsFormatted}</ul>`,
    };
    subject = processTemplate(template.subject, vars, false);
    const body = processTemplate(template.html_content, vars, false);
    htmlContent = body
      .split(/\n\n+/)
      .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("") + "\n" + signature;
  } else {
    const greeting = sponsorFormalAddress
      ? 'Bonjour,'
      : (sponsorFirstName ? `Bonjour ${escapeHtml(sponsorFirstName)},` : 'Bonjour,');

    subject = `Convocations envoyées - ${trainingName}`;
    htmlContent = `
      <p>${greeting}</p>
      <p>Nous avons le plaisir de vous informer que les convocations à la formation <strong>${escapeHtml(trainingName)}</strong> ont été envoyées aux participants suivants :</p>
      <ul style="margin-left: 20px;">
        ${participantsFormatted}
      </ul>
      <p>Chaque participant a reçu un email contenant toutes les informations pratiques relatives à la formation.</p>
      <p>Nous restons à votre disposition pour toute question.</p>
      <p>Bien cordialement,</p>
      ${signature}
    `;
  }

  const result = await sendEmail({
    to: [sponsorEmail],
    bcc: bccList,
    subject,
    html: htmlContent,
  });

  if (!result.success) {
    console.error("Error sending sponsor notification:", result.error);
    // Don't throw - this is a secondary notification
  } else {
    console.log("Sponsor notification sent to:", sponsorEmail);
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId, templateId } = await req.json();

    if (!participantId || !trainingId) {
      return createErrorResponse("participantId and trainingId are required", 400);
    }

    const supabase = getSupabaseClient();
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;

    // Fetch BCC settings and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

    // Fetch participant with sponsor info
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      throw new Error("Participant not found");
    }

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    const isInterEntreprise = training.format_formation === "inter-entreprises" || training.format_formation === "e_learning";

    // Fetch schedules for the training
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    // Fetch email template (use default welcome template if not specified)
    let template;
    if (templateId) {
      const { data: templateData } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      template = templateData;
    } else {
      // Get default welcome template
      const { data: templateData } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_type", "welcome")
        .eq("is_default", true)
        .single();
      template = templateData;
    }

    // Build schedule string
    const scheduleStr = schedules?.map(s => {
      const date = new Date(s.day_date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      return `${date} : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
    }).join('<br/>') || '';

    // Format training date
    const trainingDate = new Date(training.start_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Build training summary page URL
    const trainingSummaryUrl = `${appUrl}/formation-info/${trainingId}`;

    // Template variables
    const variables: Record<string, string> = {
      participant_first_name: participant.first_name || '',
      participant_last_name: participant.last_name || '',
      participant_email: participant.email,
      participant_company: participant.company || '',
      training_name: training.training_name,
      training_date: trainingDate,
      training_location: training.location,
      training_schedule: scheduleStr,
      client_name: training.client_name,
      training_summary_url: trainingSummaryUrl,
    };

    let subject: string;
    let htmlContent: string;

    if (template) {
      // Use template but ensure "Convocation" is in the subject
      const templateSubject = replaceVariables(template.subject, variables);
      // If subject doesn't already contain "Convocation", prepend it
      subject = templateSubject.toLowerCase().includes('convocation')
        ? templateSubject
        : `Convocation - ${templateSubject}`;
      htmlContent = replaceVariables(template.html_content, variables) + signature;
    } else {
      // Fallback default content - warm welcome email with convocation mention
      const greeting = participant.first_name ? `Bonjour ${escapeHtml(participant.first_name)},` : 'Bonjour,';
      const safeTrainingName = escapeHtml(training.training_name);
      const safeLocation = escapeHtml(training.location);

      subject = `Convocation - Formation ${training.training_name}`;
      htmlContent = `
        <p>${greeting}</p>
        <p>C'est avec grand plaisir que nous vous confirmons votre inscription à la formation <strong>${safeTrainingName}</strong>.</p>

        <p style="background-color: #fefce8; border-left: 4px solid #e6bc00; padding: 12px 16px; margin: 16px 0; font-weight: 500;">
          📋 Ce mail constitue votre convocation à la formation.
        </p>

        <p><strong>📅 Informations pratiques :</strong></p>
        <ul style="margin-left: 20px; list-style: none; padding-left: 0;">
          ${scheduleStr ? `<li style="margin-bottom: 8px;"><strong>Horaires :</strong><br/>${scheduleStr}</li>` : `<li style="margin-bottom: 8px;"><strong>Date :</strong> ${trainingDate}</li>`}
          <li style="margin-bottom: 8px;"><strong>Lieu :</strong> ${safeLocation}</li>
        </ul>

        <p><strong>📋 Prochaines étapes :</strong></p>
        <p>Dans les prochains jours, vous recevrez un email de recueil de vos besoins pour cette formation. Ce questionnaire nous permettra de personnaliser au mieux le contenu en fonction de vos attentes.</p>

        <p><strong>📍 Retrouvez toutes les informations pratiques :</strong></p>
        <p>En attendant, vous pouvez consulter l'ensemble des informations de la formation (programme, accès, contact du formateur) sur cette page :</p>
        <p style="margin: 20px 0;">
          <a href="${trainingSummaryUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Voir les informations de la formation
          </a>
        </p>

        <p>Nous restons à votre disposition pour toute question.</p>
        <p>À très bientôt ! 🙂</p>
        ${signature}
      `;
    }

    console.log("Sending welcome email to:", participant.email);
    console.log("Subject:", subject);
    console.log("Is inter-entreprise:", isInterEntreprise);

    // Build CC list for inter-enterprise (sponsor of the participant, only if different from participant)
    const ccList: string[] = [];
    if (isInterEntreprise && participant.sponsor_email && participant.sponsor_email.toLowerCase() !== participant.email.toLowerCase()) {
      ccList.push(participant.sponsor_email);
      console.log("CC to participant sponsor:", participant.sponsor_email);
    }

    const result = await sendEmail({
      to: [participant.email],
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList,
      subject,
      html: htmlContent,
    });

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    console.log("Welcome email sent successfully:", result.id);

    // Update participant status
    await supabase
      .from("training_participants")
      .update({
        needs_survey_status: "accueil_envoye",
        needs_survey_sent_at: new Date().toISOString()
      })
      .eq("id", participantId);

    // For intra-enterprise: check if we should notify the sponsor
    // We do this by checking if all participants have now received their welcome email
    if (!isInterEntreprise && training.sponsor_email) {
      // Get all participants for this training
      const { data: allParticipants } = await supabase
        .from("training_participants")
        .select("id, first_name, last_name, email, needs_survey_status")
        .eq("training_id", trainingId);

      if (allParticipants) {
        // Check if all participants have received welcome email (including the one we just sent)
        const allConvoked = allParticipants.every(p =>
          p.id === participantId ||
          p.needs_survey_status === "accueil_envoye" ||
          p.needs_survey_status === "envoye" ||
          p.needs_survey_status === "en_cours" ||
          p.needs_survey_status === "complete" ||
          p.needs_survey_status === "valide_formateur"
        );

        // If this is the last participant to be convoked, notify sponsor
        if (allConvoked) {
          const participantNames = allParticipants.map(p => {
            const name = p.first_name || p.last_name
              ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
              : p.email;
            return name;
          });

          await sendSponsorNotification(
            training.sponsor_email,
            training.sponsor_first_name,
            training.sponsor_formal_address,
            training.training_name,
            participantNames,
            signature,
            bccList
          );
        }
      }
    }

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error("Error sending welcome email:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send welcome email";
    return createErrorResponse(errorMessage);
  }
});
