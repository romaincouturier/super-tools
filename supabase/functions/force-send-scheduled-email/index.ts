import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Get Google My Business URL from settings
    const { data: gmbSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "google_my_business_url")
      .single();
    
    const googleReviewLink = gmbSetting?.setting_value || "https://g.page/r/CWJ0W_P6C-BJEAE/review";

    // Get Signitic signature
    let signatureHtml = "";
    try {
      const signatureResponse = await fetch(
        `https://api.signitic.com/v1/signatures/26ef8e56-f3df-11ef-b723-42010a40000c/html`,
        {
          headers: {
            "X-API-KEY": Deno.env.get("SIGNITIC_API_KEY") || "",
          },
        }
      );
      if (signatureResponse.ok) {
        signatureHtml = await signatureResponse.text();
      }
    } catch (e) {
      console.log("Could not fetch Signitic signature:", e);
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
        break;
      }

      case "needs_survey": {
        recipientEmail = participant?.email || "";
        const surveyToken = participant?.needs_survey_token || "";
        const surveyUrl = `https://super-tools.lovable.app/questionnaire/${surveyToken}`;
        subject = `${training.training_name} – Questionnaire de recueil des besoins`;
        htmlContent = `
          <p>${greeting}</p>
          <p>${formalAddress ? "Vous êtes inscrit(e)" : "Tu es inscrit(e)"} à la formation <strong>"${training.training_name}"</strong> qui aura lieu le ${formatDate(training.start_date)}.</p>
          <p>Afin de personnaliser cette formation à ${formalAddress ? "vos" : "tes"} attentes, je ${formalAddress ? "vous" : "t'"}invite à remplir un court questionnaire de recueil des besoins :</p>
          <p><a href="${surveyUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir le questionnaire</a></p>
          <p>Ce questionnaire ${formalAddress ? "vous" : "te"} prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à ${formalAddress ? "vos" : "tes"} besoins spécifiques.</p>
          <p>Merci de le compléter au moins 2 jours avant la formation.</p>
          ${signatureHtml}
        `;
        break;
      }

      case "reminder": {
        recipientEmail = participant?.email || "";
        subject = `Rappel : Formation ${training.training_name} – ${formatDate(training.start_date)}`;
        htmlContent = `
          <p>${greeting}</p>
          <p>${formalAddress ? "Votre" : "Ta"} formation <strong>"${training.training_name}"</strong> approche !</p>
          <p><strong>Pour rappel :</strong></p>
          <ul>
            <li>Date : ${formatDate(training.start_date)}</li>
            <li>Horaires :<br>${formatSchedules(schedules || [])}</li>
            <li>Lieu : ${training.location}</li>
          </ul>
          <p>N'${formalAddress ? "hésitez" : "hésite"} pas à me contacter si ${formalAddress ? "vous avez" : "tu as"} des questions.</p>
          <p>À très bientôt !</p>
          ${signatureHtml}
        `;
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

        const evaluationUrl = `https://super-tools.lovable.app/evaluation/${evaluationToken}`;
        const supportsSection = training.supports_url
          ? `<p>${formalAddress ? "Vous trouverez" : "Tu trouveras"} également tous les supports de la formation ici :<br><a href="${training.supports_url}">${training.supports_url}</a></p>`
          : "";

        subject = `${training.training_name} – Merci pour ${formalAddress ? "votre" : "ta"} participation !`;
        htmlContent = `
          <p>Bonjour à toutes et à tous,</p>
          <p>Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ${formalAddress ? "votre" : "ton"} énergie et ${formalAddress ? "votre" : "ta"} participation pendant notre formation <strong>"${training.training_name}"</strong>.</p>
          <p>Pour finaliser cette formation, j'ai besoin que ${formalAddress ? "vous preniez" : "tu prennes"} quelques minutes pour compléter le questionnaire d'évaluation :</p>
          <p><a href="${evaluationUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir l'évaluation</a></p>
          ${supportsSection}
          <p>Je suis curieux de voir comment ${formalAddress ? "vous allez" : "tu vas"} utiliser tout ce que nous avons vu ! N'${formalAddress ? "hésitez" : "hésite"} pas à me contacter si ${formalAddress ? "vous avez" : "tu as"} des questions.</p>
          <p>Je ${formalAddress ? "vous" : "te"} souhaite une bonne journée</p>
          ${signatureHtml}
        `;
        break;
      }

      case "trainer_summary": {
        // This is sent to the trainer
        recipientEmail = "romain@supertilt.fr";
        subject = `Synthèse pré-formation – ${training.training_name} – ${formatDate(training.start_date)}`;
        
        // Get all questionnaires for this training
        const { data: questionnaires } = await supabase
          .from("questionnaire_besoins")
          .select("*")
          .eq("training_id", training.id);

        const summaryContent = questionnaires && questionnaires.length > 0
          ? `<p>${questionnaires.length} questionnaire(s) reçu(s) pour cette formation.</p>`
          : `<p>Aucun questionnaire reçu pour cette formation.</p>`;

        htmlContent = `
          <p>Bonjour,</p>
          <p>Voici la synthèse des besoins recueillis pour la formation <strong>"${training.training_name}"</strong> prévue le ${formatDate(training.start_date)}.</p>
          ${summaryContent}
          ${signatureHtml}
        `;
        break;
      }

      case "google_review": {
        recipientEmail = participant?.email || "";
        subject = `🤩 Ton avis sur la formation ${training.training_name}`;
        htmlContent = `
          <p>${greeting}</p>
          <p>J'espère que tout va bien pour toi !</p>
          <p>Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux.<br>
          Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?</p>
          <p><a href="${googleReviewLink}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">👉 Clique ici pour laisser ton avis</a></p>
          <p>Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres personnes à découvrir nos formations.</p>
          <p>Merci infiniment pour ton soutien et pour avoir participé à notre formation ! 😊</p>
          <p>À bientôt,</p>
          ${signatureHtml}
        `;
        break;
      }

      case "video_testimonial": {
        recipientEmail = participant?.email || "";
        subject = `🎥 Ton avis sur la formation ${training.training_name} ?`;
        htmlContent = `
          <p>${greeting}</p>
          <p>J'espère que tu vas bien et que la formation <strong>"${training.training_name}"</strong> t'a apporté ce que tu en attendais.</p>
          <p>Ton retour d'expérience serait très précieux pour moi et pour les futurs participants. Serais-tu d'accord pour partager ton témoignage en vidéo ?</p>
          <p>Je te propose une courte interview ensemble via Zoom, cela prend seulement 10 minutes.</p>
          <p><a href="mailto:romain@supertilt.fr?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Salut%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20ton%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o%20%3A-)" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Je suis partant(e) !</a></p>
          <p>Les témoignages authentiques de personnes qui ont vraiment vécu la formation sont les plus inspirants pour ceux qui hésitent encore.</p>
          <p>Merci d'avance pour ton aide !</p>
          <p>Bonne journée</p>
          ${signatureHtml}
        `;
        break;
      }

      case "cold_evaluation": {
        recipientEmail = participant?.email || "";
        subject = `🫶🏻 Évaluation à froid de la formation ${training.training_name}`;
        htmlContent = `
          <p>${greeting}</p>
          <p>Comment vas-tu ?</p>
          <p>Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.</p>
          <p>❓ Pourrais-tu prendre 2 minutes pour remplir ce questionnaire en ligne ?</p>
          <p><a href="https://forms.gle/EXAMPLE" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir le questionnaire</a></p>
          <p>Merci énormément pour ton soutien :-)</p>
          <p>À bientôt</p>
          <p><em>PS : on peut continuer à rester en contact sur <a href="https://www.linkedin.com/in/romaincouturier/">LinkedIn</a> et sur <a href="https://www.instagram.com/supertilt.fr/">Instagram</a> pour d'autres contenus sur le sujet de la formation.</em></p>
          ${signatureHtml}
        `;
        break;
      }

      case "funder_reminder": {
        // This email goes to the trainer (romain@supertilt.fr) to remind about contacting the funder
        recipientEmail = "romain@supertilt.fr";
        const financeurName = training.financeur_name || "Financeur inconnu";
        const financeurUrl = training.financeur_url || "";
        
        subject = `📋 Rappel : Contacter le financeur pour ${training.training_name}`;
        htmlContent = `
          <p>Bonjour,</p>
          <p>C'est le moment de contacter le financeur pour la formation <strong>"${training.training_name}"</strong> (${training.client_name}).</p>
          <p><strong>Financeur :</strong> ${financeurName}</p>
          ${financeurUrl ? `<p><strong>URL :</strong> <a href="${financeurUrl}">${financeurUrl}</a></p>` : ""}
          <p>N'oublie pas de faire le bilan qualité avec eux !</p>
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
          // Mark as cancelled and return
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

        const evalUrl = `https://super-tools.lovable.app/evaluation/${evalCheck.token}`;
        const isFirstReminder = scheduledEmail.email_type === "evaluation_reminder_1";
        const useTutoiement = !training.participants_formal_address;

        if (isFirstReminder) {
          subject = useTutoiement 
            ? `📝 Petit rappel : ton avis compte pour "${training.training_name}"`
            : `📝 Petit rappel : votre avis compte pour "${training.training_name}"`;
          htmlContent = useTutoiement
            ? `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "${training.training_name}" !</p>
              <p>Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.</p>
              <p>Cela ne prend que 2-3 minutes :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir l'évaluation</a></p>
              <p>Un grand merci d'avance pour ta contribution !</p>
              <p>Belle journée à toi</p>
              ${signatureHtml}
            `
            : `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "${training.training_name}" !</p>
              <p>Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.</p>
              <p>Cela ne prend que 2-3 minutes :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir l'évaluation</a></p>
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
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir l'évaluation</a></p>
              <p>Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !</p>
              <p>À bientôt</p>
              ${signatureHtml}
            `
            : `
              <p>Bonjour${firstName ? ` ${firstName}` : ""},</p>
              <p>Je reviens vers vous une dernière fois concernant l'évaluation de la formation "${training.training_name}".</p>
              <p>En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !</p>
              <p>Si vous avez 2 minutes, voici le lien :</p>
              <p><a href="${evalUrl}" style="display: inline-block; background-color: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Remplir l'évaluation</a></p>
              <p>Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !</p>
              <p>À bientôt</p>
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

    // Fetch BCC settings from app_settings
    const { data: bccSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcc_enabled", "bcc_email"]);

    let bccEnabled = true;
    let bccEmail = "romain@supertilt.fr";
    
    if (bccSettings) {
      for (const setting of bccSettings) {
        if (setting.setting_key === "bcc_enabled") {
          bccEnabled = setting.setting_value === "true";
        }
        if (setting.setting_key === "bcc_email") {
          bccEmail = setting.setting_value || "romain@supertilt.fr";
        }
      }
    }

    // Build BCC list
    const bccList = ["supertilt@bcc.nocrm.io"]; // Always include nocrm.io
    if (bccEnabled && bccEmail) {
      bccList.push(bccEmail);
    }

    console.log(`BCC enabled: ${bccEnabled}, BCC list: ${bccList.join(", ")}`);

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [recipientEmail],
      bcc: bccList,
      subject,
      html: htmlContent,
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
