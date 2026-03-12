import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSenderFrom, getSenderEmail, getSenderName, getBccList } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { processTemplate } from "../_shared/templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ForceSendRequest {
  scheduledEmailId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Force send scheduled email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const appUrl = urls.app_url;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { scheduledEmailId }: ForceSendRequest = await req.json();

    if (!scheduledEmailId) {
      throw new Error("scheduledEmailId is required");
    }

    console.log("Processing scheduled email:", scheduledEmailId);

    // Get the scheduled email
    const { data: scheduledEmail, error: emailError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("id", scheduledEmailId)
      .single();

    if (emailError || !scheduledEmail) {
      throw new Error("Scheduled email not found");
    }

    if (scheduledEmail.status === "sent" || scheduledEmail.sent_at) {
      throw new Error("Email has already been sent");
    }

    // Get training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", scheduledEmail.training_id)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch required equipment from catalog if linked
    let requiredEquipment = "";
    if (training.catalog_id) {
      const { data: catalogData } = await supabase
        .from("formation_configs")
        .select("required_equipment")
        .eq("id", training.catalog_id)
        .maybeSingle();
      requiredEquipment = catalogData?.required_equipment || "";
    }

    // Get participant if applicable
    let participant = null;
    if (scheduledEmail.participant_id) {
      const { data: participantData } = await supabase
        .from("training_participants")
        .select("*")
        .eq("id", scheduledEmail.participant_id)
        .single();
      participant = participantData;
    }

    // Get schedules
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", training.id)
      .order("day_date", { ascending: true });

    // Get Google My Business URL and Cold Evaluation Form URL from settings
    const { data: gmbSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "google_my_business_url")
      .single();
    
    const { data: coldEvalSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "cold_evaluation_form_url")
      .single();
    
    const googleReviewLink = gmbSetting?.setting_value || "https://g.page/r/CWJ0W_P6C-BJEAE/review";
    const coldEvaluationFormUrl = coldEvalSetting?.setting_value || "";

    // Fetch sender email for use in templates
    const senderEmail = await getSenderEmail();

    // Get Signitic signature using correct API URL with fallback
    const signatureHtml = await getSigniticSignature();

    // Fetch all email templates for dynamic resolution
    const { data: allEmailTemplates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content");
    const templatesByType: Record<string, { subject: string; html_content: string }> = {};
    (allEmailTemplates || []).forEach((t: any) => {
      templatesByType[t.template_type] = t;
    });

    // Helper to resolve email template with variables
    function resolveEmailTemplate(
      baseType: string,
      useFormal: boolean,
      variables: Record<string, string | null | undefined>,
    ): { subject: string; htmlContent: string } | null {
      const suffix = useFormal ? "vous" : "tu";
      const template = templatesByType[`${baseType}_${suffix}`];
      if (!template) return null;
      
      const resolvedSubject = processTemplate(template.subject, variables, false);
      const body = processTemplate(template.html_content, variables, false);
      // Convert plain text newlines to HTML paragraphs, preserving any HTML in template
      const resolvedHtml = body
        .split(/\n\n+/)
        .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
        .join("") + "\n" + signatureHtml;
      return { subject: resolvedSubject, htmlContent: resolvedHtml };
    }

    // Format helpers
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const formatSchedules = (schedulesList: any[]) => {
      return schedulesList
        .map((s) => {
          const date = new Date(s.day_date).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          return `${date} : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
        })
        .join("<br>");
    };

    const firstName = participant?.first_name || "";
    const formalAddress = training.sponsor_formal_address;
    const greeting = firstName
      ? formalAddress
        ? `Bonjour ${firstName},`
        : `Bonjour ${firstName},`
      : "Bonjour,";

    let recipientEmail = "";
    let subject = "";
    let htmlContent = "";

    // Build email based on type
    switch (scheduledEmail.email_type) {
      case "welcome": {
        recipientEmail = participant?.email || "";
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          training_date: formatDate(training.start_date),
          training_schedule: formatSchedules(schedules || []),
          training_location: training.location,
        };
        const resolved = resolveEmailTemplate("welcome", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `${training.training_name} – ${formatDate(training.start_date)} – Confirmation d'inscription`;
          htmlContent = `
            <p>${greeting}</p>
            <p>Nous avons le plaisir de ${formalAddress ? "vous" : "te"} confirmer ${formalAddress ? "votre" : "ton"} inscription à la formation <strong>"${training.training_name}"</strong>.</p>
            <p><strong>Informations pratiques :</strong></p>
            <ul>
              <li>Date : ${formatDate(training.start_date)}</li>
              <li>Horaires :<br>${formatSchedules(schedules || [])}</li>
              <li>Lieu : ${training.location}</li>
            </ul>
            <p>Nous restons à ${formalAddress ? "votre" : "ta"} disposition pour toute question.</p>
            <p>À très bientôt !</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "needs_survey": {
        recipientEmail = participant?.email || "";
        const surveyToken = participant?.needs_survey_token || "";
        const surveyUrl = `${appUrl}/questionnaire/${surveyToken}`;
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          training_date: formatDate(training.start_date),
          questionnaire_link: `<a href="${surveyUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir le questionnaire</a>`,
          deadline_date: "",
        };
        const resolved = resolveEmailTemplate("needs_survey", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `${training.training_name} – Questionnaire de recueil des besoins`;
          htmlContent = `
            <p>${greeting}</p>
            <p>${formalAddress ? "Vous êtes inscrit(e)" : "Tu es inscrit(e)"} à la formation <strong>"${training.training_name}"</strong> qui aura lieu le ${formatDate(training.start_date)}.</p>
            <p>Afin de personnaliser cette formation à ${formalAddress ? "vos" : "tes"} attentes, je ${formalAddress ? "vous" : "t'"}invite à remplir un court questionnaire de recueil des besoins :</p>
            <p><a href="${surveyUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir le questionnaire</a></p>
            <p>Ce questionnaire ${formalAddress ? "vous" : "te"} prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à ${formalAddress ? "vos" : "tes"} besoins spécifiques.</p>
            <p>Merci de le compléter au moins 2 jours avant la formation.</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "reminder": {
        recipientEmail = participant?.email || "";
        const equipmentLine = requiredEquipment
          ? `<li>Matériel requis : ${requiredEquipment}</li>`
          : "";
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          training_date: formatDate(training.start_date),
          training_schedule: formatSchedules(schedules || []),
          training_location: training.location,
          required_equipment: requiredEquipment,
        };
        const resolved = resolveEmailTemplate("reminder", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `Rappel : Formation ${training.training_name} – ${formatDate(training.start_date)}`;
          htmlContent = `
            <p>${greeting}</p>
            <p>${formalAddress ? "Votre" : "Ta"} formation <strong>"${training.training_name}"</strong> approche !</p>
            <p><strong>Pour rappel :</strong></p>
            <ul>
              <li>Date : ${formatDate(training.start_date)}</li>
              <li>Horaires :<br>${formatSchedules(schedules || [])}</li>
              <li>Lieu : ${training.location}</li>
              ${equipmentLine}
            </ul>
            <p>N'${formalAddress ? "hésitez" : "hésite"} pas à me contacter si ${formalAddress ? "vous avez" : "tu as"} des questions.</p>
            <p>À très bientôt !</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "thank_you": {
        recipientEmail = participant?.email || "";
        
        // Get or create evaluation token
        let evaluationToken = "";
        const { data: existingEval } = await supabase
          .from("training_evaluations")
          .select("token")
          .eq("participant_id", participant?.id)
          .eq("training_id", training.id)
          .single();

        if (existingEval) {
          evaluationToken = existingEval.token;
        } else {
          evaluationToken = crypto.randomUUID();
          await supabase.from("training_evaluations").insert({
            training_id: training.id,
            participant_id: participant?.id,
            token: evaluationToken,
            email: participant?.email,
            first_name: participant?.first_name,
            last_name: participant?.last_name,
            company: participant?.company,
            etat: "envoye",
            date_envoi: new Date().toISOString(),
          });
        }

        const evaluationUrl = `${appUrl}/evaluation/${evaluationToken}`;
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          evaluation_link: `<a href="${evaluationUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a>`,
          supports_url: training.supports_url || "",
        };
        const resolved = resolveEmailTemplate("thank_you", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          const supportsSection = training.supports_url
            ? `<p>${formalAddress ? "Vous trouverez" : "Tu trouveras"} également tous les supports de la formation ici :<br><a href="${training.supports_url}">${training.supports_url}</a></p>`
            : "";

          subject = `${training.training_name} – Merci pour ${formalAddress ? "votre" : "ta"} participation !`;
          htmlContent = `
            <p>Bonjour à toutes et à tous,</p>
            <p>Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ${formalAddress ? "votre" : "ton"} énergie et ${formalAddress ? "votre" : "ta"} participation pendant notre formation <strong>"${training.training_name}"</strong>.</p>
            <p>Pour finaliser cette formation, j'ai besoin que ${formalAddress ? "vous preniez" : "tu prennes"} quelques minutes pour compléter le questionnaire d'évaluation :</p>
            <p><a href="${evaluationUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a></p>
            ${supportsSection}
            <p>Je suis curieux de voir comment ${formalAddress ? "vous allez" : "tu vas"} utiliser tout ce que nous avons vu ! N'${formalAddress ? "hésitez" : "hésite"} pas à me contacter si ${formalAddress ? "vous avez" : "tu as"} des questions.</p>
            <p>Je ${formalAddress ? "vous" : "te"} souhaite une bonne journée</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "trainer_summary": {
        // Get trainer info from trainers table
        let trainerEmail = await getSenderEmail();
        const senderFullName = await getSenderName();
        let trainerFirstName = senderFullName.split(" ")[0];
        if (training.trainer_id) {
          const { data: trainer } = await supabase
            .from("trainers")
            .select("email, first_name")
            .eq("id", training.trainer_id)
            .single();
          if (trainer) {
            trainerEmail = trainer.email;
            trainerFirstName = trainer.first_name;
          }
        }
        recipientEmail = trainerEmail;

        // Get completed questionnaires count
        const { data: questionnaires } = await supabase
          .from("questionnaire_besoins")
          .select("id, etat")
          .eq("training_id", training.id);

        const completedCount = questionnaires?.filter(q => q.etat === "complete").length || 0;
        const totalCount = questionnaires?.length || 0;

        // Call AI to generate summary if there are completed questionnaires
        let aiSummaryHtml = "";
        if (completedCount > 0) {
          try {
            const summaryResponse = await fetch(
              `${supabaseUrl}/functions/v1/summarize-needs-survey`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ trainingId: training.id }),
              }
            );

            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              if (summaryData.success && summaryData.summary) {
                const summaryText = summaryData.summary
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/^- (.*)/gm, "<li>$1</li>")
                  .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
                  .replace(/\n\n/g, "</p><p>")
                  .replace(/\n/g, "<br>");
                aiSummaryHtml = `<div style="background-color: #f8f9fa; border-left: 4px solid #e6bc00; padding: 16px; border-radius: 4px; margin: 16px 0;">${summaryText}</div>`;
              }
            } else {
              console.warn("Failed to get AI summary:", summaryResponse.status);
            }
          } catch (aiError) {
            console.warn("Error calling summarize-needs-survey:", aiError);
          }
        }

        const statsLine = completedCount > 0
          ? `<p>📊 <strong>${completedCount} questionnaire(s) complété(s)</strong> sur ${totalCount} envoyé(s).</p>`
          : `<p>⚠️ Aucun questionnaire complété pour cette formation (${totalCount} envoyé(s)).</p>`;

        const noSummaryFallback = completedCount === 0
          ? `<p>Pas de synthèse disponible car aucun participant n'a encore répondu au questionnaire de recueil des besoins.</p>`
          : "";

        const vars = {
          first_name: trainerFirstName,
          training_name: training.training_name,
          client_name: training.client_name,
          training_date: formatDate(training.start_date),
          training_location: training.location,
          training_schedule: schedules && schedules.length > 0 ? formatSchedules(schedules) : "",
          survey_stats: statsLine,
          ai_summary: aiSummaryHtml || noSummaryFallback,
        };
        const resolved = resolveEmailTemplate("trainer_summary", false, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `☀️ Demain c'est le grand jour ! Synthèse pré-formation – ${training.training_name}`;
          htmlContent = `
            <p>Salut ${trainerFirstName} 👋</p>
            <p>Ta formation <strong>"${training.training_name}"</strong> pour <strong>${training.client_name}</strong> a lieu <strong>demain ${formatDate(training.start_date)}</strong> !</p>
            <p>📍 Lieu : ${training.location}</p>
            ${schedules && schedules.length > 0 ? `<p>🕐 Horaires :<br>${formatSchedules(schedules)}</p>` : ""}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="color: #333;">🎯 Synthèse des besoins des participants</h3>
            ${statsLine}
            ${aiSummaryHtml || noSummaryFallback}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p>Bonne préparation et bonne formation demain ! 🚀</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "google_review": {
        recipientEmail = participant?.email || "";
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          google_review_link: googleReviewLink,
        };
        const resolved = resolveEmailTemplate("google_review", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `🤩 Ton avis sur la formation ${training.training_name}`;
          htmlContent = `
            <p>${greeting}</p>
            <p>J'espère que tout va bien pour toi !</p>
            <p>Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux.<br>
            Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?</p>
            <p><a href="${googleReviewLink}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">👉 Clique ici pour laisser ton avis</a></p>
            <p>Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres personnes à découvrir nos formations.</p>
            <p>Merci infiniment pour ton soutien et pour avoir participé à notre formation ! 😊</p>
            <p>À bientôt,</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "video_testimonial": {
        recipientEmail = participant?.email || "";
        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          sender_email: senderEmail,
        };
        const resolved = resolveEmailTemplate("video_testimonial", formalAddress, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `🎥 Ton avis sur la formation ${training.training_name} ?`;
          htmlContent = `
            <p>${greeting}</p>
            <p>J'espère que tu vas bien et que la formation <strong>"${training.training_name}"</strong> t'a apporté ce que tu en attendais.</p>
            <p>Ton retour d'expérience serait très précieux pour moi et pour les futurs participants. Serais-tu d'accord pour partager ton témoignage en vidéo ?</p>
            <p>Je te propose une courte interview ensemble via Zoom, cela prend seulement 10 minutes.</p>
            <p><a href="mailto:${senderEmail}?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Salut%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20ton%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o%20%3A-)" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Je suis partant(e) !</a></p>
            <p>Les témoignages authentiques de personnes qui ont vraiment vécu la formation sont les plus inspirants pour ceux qui hésitent encore.</p>
            <p>Merci d'avance pour ton aide !</p>
            <p>Bonne journée</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "cold_evaluation": {
        const coldAppUrl = appUrl;
        const sponsorEmail = participant?.sponsor_email || training.sponsor_email || "";
        const sponsorName = participant?.sponsor_name ||
          [training.sponsor_first_name, training.sponsor_last_name].filter(Boolean).join(" ") ||
          "";
        const sponsorCompany = participant?.company || training.client_name || "";
        recipientEmail = sponsorEmail;

        if (!recipientEmail) {
          throw new Error("No sponsor email found for cold evaluation");
        }

        const coldToken = crypto.randomUUID();

        const { error: insertErr } = await supabase
          .from("sponsor_cold_evaluations")
          .insert({
            training_id: training.id,
            participant_id: participant?.id || null,
            token: coldToken,
            etat: "envoye",
            sponsor_email: recipientEmail,
            sponsor_name: sponsorName,
            company: sponsorCompany,
            training_name: training.training_name,
            training_start_date: training.start_date,
            training_end_date: training.end_date || null,
            date_envoi: new Date().toISOString(),
          });

        if (insertErr) {
          console.error("Error creating sponsor cold evaluation record:", insertErr);
          throw new Error("Failed to create sponsor evaluation record");
        }

        const coldFormUrl = `${coldAppUrl}/evaluation-commanditaire/${coldToken}`;
        const sponsorFirstName = sponsorName.split(" ")[0];

        const vars = {
          first_name: sponsorFirstName,
          training_name: training.training_name,
          evaluation_link: `<a href="${coldFormUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir le questionnaire</a>`,
        };
        const resolved = resolveEmailTemplate("cold_evaluation", training.sponsor_formal_address, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          const sponsorGreeting = sponsorFirstName
            ? training.sponsor_formal_address
              ? `Bonjour ${sponsorFirstName},`
              : `Bonjour ${sponsorFirstName},`
            : "Bonjour,";

          subject = `🫶🏻 Évaluation à froid de la formation ${training.training_name}`;
          htmlContent = `
            <p>${sponsorGreeting}</p>
            <p>Comment allez-vous ?</p>
            <p>Dans le cadre de mon processus qualité (Qualiopi), je vous propose de remplir une évaluation à froid de la formation <strong>"${training.training_name}"</strong>.</p>
            <p>❓ Cela ne prend que 2 minutes :</p>
            <p><a href="${coldFormUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir le questionnaire</a></p>
            <p>Vos retours sont précieux et m'aident à améliorer continuellement mes formations.</p>
            <p>Merci pour votre temps !</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "funder_reminder": {
        recipientEmail = await getSenderEmail();
        const financeurName = participant?.financeur_name || training.financeur_name || "Financeur inconnu";
        const financeurUrl = participant?.financeur_url || training.financeur_url || "";
        const participantName = participant
          ? [participant.first_name, participant.last_name].filter(Boolean).join(" ")
          : "";
        const trainingUrl = `${appUrl}/formations/${training.id}`;

        const vars = {
          first_name: "",
          training_name: training.training_name,
          financeur_name: financeurName,
          financeur_url: financeurUrl,
          participant_name: participantName,
          training_url: trainingUrl,
        };
        const resolved = resolveEmailTemplate("funder_reminder", false, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else {
          subject = `📋 Rappel : Contacter le financeur pour ${training.training_name}${participantName ? ` (${participantName})` : ""}`;
          htmlContent = `
            <p>Bonjour,</p>
            <p>C'est le moment de contacter le financeur pour la formation <strong>"${training.training_name}"</strong> (${training.client_name}).</p>
            ${participantName ? `<p><strong>Participant :</strong> ${participantName}${participant?.email ? ` (${participant.email})` : ""}</p>` : ""}
            <p><strong>Financeur :</strong> ${financeurName}</p>
            ${financeurUrl ? `<p><strong>URL :</strong> <a href="${financeurUrl}">${financeurUrl}</a></p>` : ""}
            <p>N'oublie pas de faire le bilan qualité avec eux !</p>
            <p><a href="${trainingUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Voir la formation</a></p>
            ${signatureHtml}
          `;
        }
        break;
      }

      case "follow_up_news": {
        recipientEmail = participant?.email || "";
        if (!recipientEmail) throw new Error("No participant email for follow-up");

        const useTu = !training.participants_formal_address;
        const participantFirstName = firstName || "là";

        // Fetch participant's evaluation to personalize the message
        let evalContext = "";
        const { data: participantEval } = await supabase
          .from("training_evaluations")
          .select("objectif_prioritaire, delai_application, freins_application, appreciation_generale")
          .eq("training_id", training.id)
          .eq("participant_id", participant?.id)
          .eq("etat", "soumis")
          .maybeSingle();

        if (participantEval) {
          if (participantEval.objectif_prioritaire) {
            evalContext += `\nObjectif prioritaire mentionné par le participant : "${participantEval.objectif_prioritaire}"`;
          }
          if (participantEval.freins_application) {
            evalContext += `\nFreins anticipés : "${participantEval.freins_application}"`;
          }
          if (participantEval.appreciation_generale) {
            evalContext += `\nNote de satisfaction : ${participantEval.appreciation_generale}/5`;
          }
        }

        // Use AI to craft a personalized, informal follow-up message
        const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
        let followUpBody = "";

        if (ANTHROPIC_API_KEY) {
          try {
            const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 500,
                system: `Tu écris un court email de suivi informel pour un formateur qui reprend des nouvelles d'un ancien participant.

Règles :
- Ton chaleureux, humain, comme un message entre collègues
- ${useTu ? "Tutoiement obligatoire" : "Vouvoiement obligatoire"}
- Maximum 4-5 phrases, pas plus
- PAS de bouton, PAS de lien, PAS de questionnaire, PAS de formulaire
- Le but est juste de prendre des nouvelles et ouvrir la conversation
- Si un objectif prioritaire est mentionné, y faire référence naturellement
- Terminer par une question ouverte qui invite à répondre
- NE PAS mettre de signature (elle sera ajoutée automatiquement)
- NE PAS mettre de formule de politesse finale type "Cordialement"
- Retourner UNIQUEMENT le corps du message en HTML (balises <p>)`,
                messages: [{
                  role: "user",
                  content: `Écris un email de suivi informel :
- Prénom du participant : ${participantFirstName}
- Formation suivie : "${training.training_name}"
- Entreprise : ${training.client_name || "non renseignée"}
- Délai depuis la formation : environ 1 mois${evalContext}`,
                }],
              }),
            });

            if (aiResponse.ok) {
              const aiResult = await aiResponse.json();
              followUpBody = aiResult.content?.[0]?.text || "";
            }
          } catch (aiErr) {
            console.warn("AI generation failed for follow-up, using default:", aiErr);
          }
        }

        // Fallback: try template, then hardcoded
        if (!followUpBody) {
          const vars = {
            first_name: participantFirstName,
            training_name: training.training_name,
          };
          const resolved = resolveEmailTemplate("follow_up_news", !useTu, vars);
          if (resolved) {
            subject = resolved.subject;
            htmlContent = resolved.htmlContent;
            break;
          }
          followUpBody = useTu
            ? `<p>Salut ${participantFirstName},</p>
               <p>Ça fait environ un mois que tu as suivi la formation "${training.training_name}" et je voulais prendre de tes nouvelles !</p>
               <p>Tu as réussi à mettre des choses en pratique depuis ? Je serais curieux de savoir ce qui a le mieux marché pour toi.</p>
               <p>N'hésite pas à me répondre, même en deux mots !</p>`
            : `<p>Bonjour ${participantFirstName},</p>
               <p>Cela fait environ un mois que vous avez suivi la formation "${training.training_name}" et je souhaitais prendre de vos nouvelles !</p>
               <p>Avez-vous eu l'occasion de mettre des choses en pratique depuis ? Je serais curieux de savoir ce qui a le mieux fonctionné pour vous.</p>
               <p>N'hésitez pas à me répondre, même en quelques mots !</p>`;
        }

        subject = useTu
          ? `${participantFirstName}, des nouvelles depuis la formation ?`
          : `${participantFirstName}, des nouvelles depuis la formation ?`;
        htmlContent = `
          ${followUpBody}
          ${signatureHtml}
        `;
        break;
      }

      case "evaluation_reminder_1":
      case "evaluation_reminder_2": {
        recipientEmail = participant?.email || "";
        
        // Check if evaluation already submitted
        const { data: evalCheck } = await supabase
          .from("training_evaluations")
          .select("id, etat, token")
          .eq("training_id", training.id)
          .eq("participant_id", participant?.id)
          .single();

        if (evalCheck && evalCheck.etat === "soumis") {
          await supabase
            .from("scheduled_emails")
            .update({ status: "cancelled", error_message: "Évaluation déjà soumise" })
            .eq("id", scheduledEmailId);
          
          return new Response(
            JSON.stringify({ success: true, message: "Reminder cancelled - evaluation already submitted" }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        if (!evalCheck) {
          throw new Error("No evaluation record found for participant");
        }

        const evalUrl = `${appUrl}/evaluation/${evalCheck.token}`;
        const isFirstReminder = scheduledEmail.email_type === "evaluation_reminder_1";
        const useTutoiement = !training.participants_formal_address;
        const templateType = isFirstReminder ? "evaluation_reminder_1" : "evaluation_reminder_2";

        const vars = {
          first_name: firstName,
          training_name: training.training_name,
          evaluation_link: `<a href="${evalUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a>`,
        };
        const resolved = resolveEmailTemplate(templateType, !useTutoiement, vars);
        if (resolved) {
          subject = resolved.subject;
          htmlContent = resolved.htmlContent;
        } else if (isFirstReminder) {
          subject = useTutoiement 
            ? `📝 Petit rappel : ton avis compte pour "${training.training_name}"`
            : `📝 Petit rappel : votre avis compte pour "${training.training_name}"`;
          htmlContent = useTutoiement
            ? `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "${training.training_name}" !</p>
              <p>Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.</p>
              <p>Cela ne prend que 2-3 minutes :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a></p>
              <p>Un grand merci d'avance pour ta contribution !</p>
              <p>Belle journée à toi</p>
              ${signatureHtml}
            `
            : `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "${training.training_name}" !</p>
              <p>Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.</p>
              <p>Cela ne prend que 2-3 minutes :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a></p>
              <p>Un grand merci d'avance pour votre contribution !</p>
              <p>Belle journée à vous</p>
              ${signatureHtml}
            `;
        } else {
          subject = useTutoiement
            ? `🙏 Dernière relance : ta contribution pour "${training.training_name}"`
            : `🙏 Dernière relance : votre contribution pour "${training.training_name}"`;
          htmlContent = useTutoiement
            ? `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>Je reviens vers toi une dernière fois concernant l'évaluation de la formation "${training.training_name}".</p>
              <p>En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !</p>
              <p>Si tu as 2 minutes, voici le lien :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a></p>
              <p>Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !</p>
              <p>À bientôt</p>
              ${signatureHtml}
            `
            : `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>Je reviens vers vous une dernière fois concernant l'évaluation de la formation "${training.training_name}".</p>
              <p>En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !</p>
              <p>Si vous avez 2 minutes, voici le lien :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Remplir l'évaluation</a></p>
              <p>Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !</p>
              <p>À bientôt</p>
              ${signatureHtml}
            `;
        }
        break;
      }

      case "live_reminder": {
        recipientEmail = participant?.email || "";
        if (!recipientEmail) throw new Error("No participant email for live reminder");

        const liveIdMatch = scheduledEmail.error_message?.match(/live:(.+)/);
        const liveMeetingId = liveIdMatch ? liveIdMatch[1] : null;

        let liveTitle = "un live collectif";
        let liveDate = "";
        let liveTime = "";
        let liveMeetingUrl = "";
        let liveEmailContent = "";

        if (liveMeetingId) {
          const { data: liveMeeting } = await supabase
            .from("training_live_meetings")
            .select("title, scheduled_at, meeting_url, status, email_content")
            .eq("id", liveMeetingId)
            .single();

          if (liveMeeting) {
            if (liveMeeting.status === "cancelled") {
              await supabase
                .from("scheduled_emails")
                .update({ status: "cancelled", error_message: "Live annulé" })
                .eq("id", scheduledEmailId);
              return new Response(
                JSON.stringify({ success: true, message: "Reminder cancelled - live cancelled" }),
                { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
              );
            }
            liveTitle = liveMeeting.title;
            const liveDateTime = new Date(liveMeeting.scheduled_at);
            liveDate = liveDateTime.toLocaleDateString("fr-FR", {
              timeZone: "Europe/Paris",
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            liveTime = liveDateTime.toLocaleTimeString("fr-FR", {
              timeZone: "Europe/Paris",
              hour: "2-digit",
              minute: "2-digit",
            });
            liveMeetingUrl = liveMeeting.meeting_url || "";
            liveEmailContent = liveMeeting.email_content || "";
          }
        }

        // If custom email content was set on the live meeting, use it directly
        if (liveEmailContent) {
          const customBody = liveEmailContent.replace(/\n/g, "<br>");
          const meetingUrlSection = liveMeetingUrl
            ? `<p><a href="${liveMeetingUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>`
            : "";
          subject = `📺 Rappel : Live "${liveTitle}" aujourd'hui – ${training.training_name}`;
          htmlContent = `
            <p>${greeting}</p>
            ${customBody}
            ${meetingUrlSection}
            ${signatureHtml}
          `;
        } else {
          // Try template
          const vars = {
            first_name: firstName,
            training_name: training.training_name,
            live_title: liveTitle,
            live_date: liveDate,
            live_time: liveTime,
            meeting_url: liveMeetingUrl,
          };
          const resolved = resolveEmailTemplate("live_reminder", formalAddress, vars);
          if (resolved) {
            subject = resolved.subject;
            htmlContent = resolved.htmlContent;
          } else {
            const meetingUrlSection = liveMeetingUrl
              ? `<p><a href="${liveMeetingUrl}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>`
              : "";

            subject = `📺 Rappel : Live "${liveTitle}" aujourd'hui – ${training.training_name}`;
            htmlContent = `
              <p>${greeting}</p>
              <p>Pour rappel, ${formalAddress ? "vous avez" : "tu as"} un live collectif prévu aujourd'hui dans le cadre de la formation <strong>"${training.training_name}"</strong> :</p>
              <ul>
                <li><strong>${liveTitle}</strong></li>
                <li>📅 ${liveDate} à ${liveTime}</li>
              </ul>
              ${meetingUrlSection}
              <p>${formalAddress ? "Votre" : "Ta"} présence est importante pour profiter pleinement de ce moment d'échange.</p>
              <p>À tout à l'heure !</p>
              ${signatureHtml}
            `;
          }
        }
        break;
      }

      case "coaching_booking_invite":
      case "coaching_first_invite":
      case "coaching_periodic_reminder":
      case "coaching_final_reminder": {
        recipientEmail = participant?.email || "";
        if (!recipientEmail) throw new Error("No participant email for coaching email");

        const coachingTotal = participant?.coaching_sessions_total || 0;
        const coachingCompleted = participant?.coaching_sessions_completed || 0;
        const coachingRemaining = coachingTotal - coachingCompleted;
        const coachingDeadline = participant?.coaching_deadline
          ? new Date(participant.coaching_deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
          : "";

        // Guard: if coaching data is incomplete, alert the trainer instead of sending a broken email
        if (coachingRemaining <= 0 || !coachingDeadline) {
          const alertReasons: string[] = [];
          if (coachingRemaining <= 0) alertReasons.push(`séances restantes = ${coachingRemaining} (total: ${coachingTotal}, complétées: ${coachingCompleted})`);
          if (!coachingDeadline) alertReasons.push("date de validité du coaching absente");

          console.warn(`[force-send] Coaching data incomplete for ${participant?.email}, sending alert to trainer instead. Reasons: ${alertReasons.join(", ")}`);

          // Send alert to trainer/admin instead
          recipientEmail = senderEmail;
          subject = `⚠️ Alerte coaching – Données incomplètes pour ${firstName} ${participant?.last_name || ""}`;
          htmlContent = `
            <p>Bonjour,</p>
            <p>Un email de coaching (<strong>${scheduledEmail.email_type}</strong>) était prévu pour <strong>${firstName} ${participant?.last_name || ""}</strong> (${participant?.email}) dans le cadre de la formation <strong>"${training.training_name}"</strong>, mais les données sont incomplètes :</p>
            <ul>
              ${alertReasons.map((r: string) => `<li>${r}</li>`).join("")}
            </ul>
            <p>Merci de vérifier et corriger les informations du participant avant de relancer l'envoi.</p>
            ${signatureHtml}
          `;
          break;
        }

        const coachingVars = {
          first_name: firstName,
          prenom: firstName,
          formation: training.training_name,
          formule: participant?.formula || "",
          coaching_sessions_total: String(coachingTotal),
          coaching_sessions_remaining: String(coachingRemaining),
          coaching_deadline: coachingDeadline,
        };

        const coachingTemplateType = scheduledEmail.email_type;
        const coachingResolved = resolveEmailTemplate(coachingTemplateType, formalAddress, coachingVars);
        if (coachingResolved) {
          subject = coachingResolved.subject;
          htmlContent = coachingResolved.htmlContent;
        } else {
          subject = `Coaching individuel – ${training.training_name}`;
          const deadlineLine = coachingDeadline
            ? `<p>Ces séances sont valables jusqu'au <strong>${coachingDeadline}</strong>.</p>`
            : "";
          htmlContent = `
            <p>${greeting}</p>
            <p>${formalAddress ? "Vous bénéficiez" : "Tu bénéficies"} de <strong>${coachingTotal} séance(s) de coaching</strong> dans le cadre de la formation "${training.training_name}".</p>
            ${deadlineLine}
            <p>Les instructions pour réserver sont disponibles dans ${formalAddress ? "votre" : "ton"} espace personnel de formation.</p>
            ${signatureHtml}
          `;
        }
        break;
      }

      default:
        throw new Error(`Unknown email type: ${scheduledEmail.email_type}`);
    }

    if (!recipientEmail) {
      throw new Error("No recipient email found");
    }

    console.log(`Sending ${scheduledEmail.email_type} email to ${recipientEmail}`);

    // Fetch BCC list and sender from shared settings
    const bccList = await getBccList();
    const senderFrom = await getSenderFrom();

    console.log(`BCC list: ${bccList.join(", ")}`);

    const emailResponse = await sendEmail({
      from: senderFrom,
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: htmlContent,
      _emailType: `scheduled_${scheduledEmail.email_type}`,
      _trainingId: training.id,
      _participantId: scheduledEmail.participant_id || undefined,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update the scheduled email status
    const { error: updateError } = await supabase
      .from("scheduled_emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", scheduledEmailId);

    if (updateError) {
      console.error("Error updating scheduled email:", updateError);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      action_type: "scheduled_email_force_sent",
      recipient_email: recipientEmail,
      details: {
        scheduled_email_id: scheduledEmailId,
        email_type: scheduledEmail.email_type,
        training_id: training.id,
        training_name: training.training_name,
      },
    });

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in force-send-scheduled-email:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
