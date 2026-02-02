import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY");
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

interface ProcessRequest {
  evaluationId: string;
}

// Helper to format name properly
const formatName = (firstName: string | null, lastName: string | null): string => {
  if (!firstName && !lastName) return "";
  if (firstName && lastName) {
    return `${firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()} ${lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()}`;
  }
  return (firstName || lastName || "").charAt(0).toUpperCase() + (firstName || lastName || "").slice(1).toLowerCase();
};

// Helper to format date in French
const formatDateFr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// Helper to get Google access token from service account
const getGoogleAccessToken = async (): Promise<string> => {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const serviceAccount = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);

  // Create JWT header and claims
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Base64url encode
  const b64 = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken = `${b64(header)}.${b64(claims)}`;

  // Import private key and sign
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
};

// Upload file to Google Drive
const uploadToDrive = async (
  accessToken: string,
  fileName: string,
  fileContent: Uint8Array,
  folderId: string
): Promise<string> => {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/pdf",
  };

  const boundary = "foo_bar_baz";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataStr = JSON.stringify(metadata);

  // Build multipart body manually
  const encoder = new TextEncoder();
  const part1 = encoder.encode(
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}${delimiter}Content-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n`
  );
  const part2 = encoder.encode(btoa(String.fromCharCode(...fileContent)));
  const part3 = encoder.encode(closeDelimiter);

  const body = new Uint8Array(part1.length + part2.length + part3.length);
  body.set(part1, 0);
  body.set(part2, part1.length);
  body.set(part3, part1.length + part2.length);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const result = await response.json();
  if (!result.id) {
    throw new Error(`Failed to upload to Drive: ${JSON.stringify(result)}`);
  }

  return `https://drive.google.com/file/d/${result.id}/view`;
};

// Get Signitic signature
const getSignature = async (): Promise<string> => {
  try {
    const response = await fetch(
      "https://api.signitic.com/v1/signatures/26ef8e56-f3df-11ef-b723-42010a40000c/html",
      {
        headers: { "X-API-KEY": Deno.env.get("SIGNITIC_API_KEY") || "" },
      }
    );
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.log("Could not fetch Signitic signature:", e);
  }
  return "";
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Process evaluation submission function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { evaluationId }: ProcessRequest = await req.json();

    if (!evaluationId) {
      throw new Error("evaluationId is required");
    }

    console.log("Processing evaluation:", evaluationId);

    // Get evaluation with training info
    const { data: evaluation, error: evalError } = await supabase
      .from("training_evaluations")
      .select("*")
      .eq("id", evaluationId)
      .single();

    if (evalError || !evaluation) {
      throw new Error("Evaluation not found");
    }

    // Get training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", evaluation.training_id)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Get schedules for duration calculation
    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", training.id)
      .order("day_date", { ascending: true });

    // Calculate duration: 3.5h per half-day, 7h per full day
    let totalHours = 0;
    if (schedules && schedules.length > 0) {
      for (const s of schedules) {
        const [startH, startM] = s.start_time.split(":").map(Number);
        const [endH, endM] = s.end_time.split(":").map(Number);
        const sessionMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        // Half-day (<=4h) = 3.5h, Full day (>4h) = 7h
        if (sessionMinutes <= 240) {
          totalHours += 3.5;
        } else {
          totalHours += 7;
        }
      }
    }

    const signatureHtml = await getSignature();

    // Format participant info
    const firstName = evaluation.first_name || "";
    const lastName = evaluation.last_name || "";
    const company = evaluation.company || "";
    const email = evaluation.email || "";
    const fullName = formatName(firstName, lastName);

    // Format date for certificate
    let dateFormation = "";
    if (training.start_date) {
      if (training.end_date && training.end_date !== training.start_date) {
        dateFormation = ` du ${formatDateFr(training.start_date)} au ${formatDateFr(training.end_date)}`;
      } else {
        dateFormation = ` le ${formatDateFr(training.start_date)}`;
      }
    }

    // Format duration
    const dureeStr = `${totalHours}h en présentiel`;
    const todayFormatted = new Date().toLocaleDateString("fr-FR");

    // ========================================
    // 1. Generate certificate via PDF Monkey
    // ========================================
    console.log("Generating certificate via PDF Monkey...");

    const pdfMonkeyPayload = {
      document: {
        document_template_id: "6593BDA5-6890-45E8-804F-77488D64BEDF",
        status: "pending",
        payload: {
          STAGIAIRE: fullName || "Participant",
          ENTREPRISE: company || "—",
          TITRE_FORMATION: training.training_name,
          DATE_FORMATION: dateFormation,
          DUREE: dureeStr,
          _date: todayFormatted,
        },
        meta: {
          _filename: `Certificat_${fullName.replace(/\s+/g, "_")}_${training.training_name.replace(/\s+/g, "_")}.pdf`,
        },
      },
    };

    const pdfMonkeyResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PDFMONKEY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pdfMonkeyPayload),
    });

    const pdfMonkeyResult = await pdfMonkeyResponse.json();
    const documentId = pdfMonkeyResult.document?.id;

    if (!documentId) {
      throw new Error(`PDF Monkey failed: ${JSON.stringify(pdfMonkeyResult)}`);
    }

    console.log("PDF Monkey document created:", documentId);

    // Poll for PDF completion
    let pdfUrl = "";
    let attempts = 0;
    const maxAttempts = 30;

    while (!pdfUrl && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      attempts++;

      const statusResponse = await fetch(
        `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
        {
          headers: { Authorization: `Bearer ${PDFMONKEY_API_KEY}` },
        }
      );

      const statusData = await statusResponse.json();
      if (statusData.document?.status === "success" && statusData.document?.download_url) {
        pdfUrl = statusData.document.download_url;
      } else if (statusData.document?.status === "failure") {
        throw new Error(`PDF generation failed: ${JSON.stringify(statusData)}`);
      }
    }

    if (!pdfUrl) {
      throw new Error("PDF generation timed out");
    }

    console.log("PDF generated:", pdfUrl);

    // Download PDF content
    const pdfResponse = await fetch(pdfUrl);
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfArrayBuffer);

    // ========================================
    // 2. Upload to Google Drive
    // ========================================
    let driveUrl = "";
    try {
      console.log("Uploading to Google Drive...");
      const accessToken = await getGoogleAccessToken();
      const fileName = `Certificat_${fullName.replace(/\s+/g, "_")}_${training.training_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      // Folder ID from the URL: 1efGGvd1PPABHOfw2Yk6MXKn6HBlgabLD
      driveUrl = await uploadToDrive(accessToken, fileName, pdfBytes, "1efGGvd1PPABHOfw2Yk6MXKn6HBlgabLD");
      console.log("Uploaded to Drive:", driveUrl);
    } catch (driveError) {
      console.error("Google Drive upload failed:", driveError);
      // Continue without Drive upload
    }

    // ========================================
    // 3. Send notification to emmanuelle@supertilt.fr
    // ========================================
    console.log("Sending notification to Emmanuelle...");

    const consentText = evaluation.consent_publication ? "Oui, j'accepte la publication" : "Non, je veux rester anonyme";
    const nameDisplay = evaluation.consent_publication
      ? `${firstName} ${lastName ? lastName.charAt(0) + "." : ""} - ${company}`
      : `Anonyme, ${company}`;

    const supertiltLink = training.supertilt_link
      ? `<p><strong>Lien de la formation :</strong> <a href="${training.supertilt_link}">${training.supertilt_link}</a></p>`
      : "";

    const notificationHtml = `
      <p>Bonjour Emmanuelle,</p>
      <p>Une nouvelle évaluation a été soumise et nécessite potentiellement la création d'un commentaire sur le site.</p>
      <hr>
      <p><strong>Formation :</strong> ${training.training_name}</p>
      <p><strong>Consentement :</strong> ${consentText}</p>
      <p><strong>Étoiles :</strong> ${evaluation.appreciation_generale}/5</p>
      <p><strong>Votre avis :</strong></p>
      <blockquote style="background: #f9f9f9; border-left: 4px solid #ccc; padding: 10px; margin: 10px 0;">${evaluation.message_recommandation || "Aucun avis laissé"}</blockquote>
      <p><strong>Nom :</strong> ${nameDisplay}</p>
      ${supertiltLink}
      ${signatureHtml}
    `;

    await resend.emails.send({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: ["emmanuelle@supertilt.fr"],
      bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
      subject: `Commentaire à créer sur le site - ${training.training_name}`,
      html: notificationHtml,
    });

    // ========================================
    // 4. Send certificate to participant
    // ========================================
    console.log("Sending certificate to participant...");

    const greetingParticipant = fullName ? `Bonjour ${fullName},` : "Bonjour,";

    const certificateEmailHtml = `
      <p>${greetingParticipant}</p>
      <p>Je te remercie pour ton évaluation.</p>
      <p>Tu trouveras en pièce jointe ton certificat de réalisation pour la formation <strong>${training.training_name}</strong>.</p>
      <p>Je te souhaite de bien exploiter tout ce que tu as vu pendant la formation !</p>
      <p>Si tu souhaites aller plus loin, je t'invite à te rendre régulièrement sur <a href="https://www.supertilt.fr">www.supertilt.fr</a> et à consulter ma <a href="https://www.youtube.com/@supertilt">chaîne YouTube</a>.</p>
      <p>Bonne continuation et à bientôt !</p>
      ${signatureHtml}
    `;

    // Convert PDF to base64 for attachment
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    await resend.emails.send({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [email],
      bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
      subject: `Ton certificat de réalisation pour la formation ${training.training_name}`,
      html: certificateEmailHtml,
      attachments: [
        {
          filename: `Certificat_${training.training_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    // ========================================
    // 5. Schedule follow-up emails
    // ========================================
    console.log("Scheduling follow-up emails...");

    // Fetch working days configuration
    const { data: workingDaysSettings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "working_days")
      .single();
    
    let workingDays = [false, true, true, true, true, true, false]; // Default: Mon-Fri
    if (workingDaysSettings?.setting_value) {
      try {
        const parsed = JSON.parse(workingDaysSettings.setting_value);
        if (Array.isArray(parsed) && parsed.length === 7) {
          workingDays = parsed;
        }
      } catch {
        // Keep default
      }
    }
    
    // Helper function to adjust date to next working day
    const adjustToWorkingDay = (date: Date): Date => {
      const result = new Date(date);
      const maxIterations = 7;
      let iterations = 0;
      
      while (!workingDays[result.getDay()] && iterations < maxIterations) {
        result.setDate(result.getDate() + 1);
        iterations++;
      }
      
      return result;
    };

    const now = new Date();
    const trainingName = training.training_name;
    const greetingFirstName = firstName ? `Bonjour ${firstName},` : "Bonjour,";

    // J+1: Google review request
    const j1Date = new Date(now);
    j1Date.setDate(j1Date.getDate() + 1);
    j1Date.setHours(10, 0, 0, 0);
    const adjustedJ1Date = adjustToWorkingDay(j1Date);

    await supabase.from("scheduled_emails").insert({
      training_id: training.id,
      participant_id: evaluation.participant_id,
      email_type: "google_review",
      scheduled_for: adjustedJ1Date.toISOString(),
      status: "pending",
    });

    // J+7: Video testimonial request
    const j7Date = new Date(now);
    j7Date.setDate(j7Date.getDate() + 7);
    j7Date.setHours(10, 0, 0, 0);
    const adjustedJ7Date = adjustToWorkingDay(j7Date);

    await supabase.from("scheduled_emails").insert({
      training_id: training.id,
      participant_id: evaluation.participant_id,
      email_type: "video_testimonial",
      scheduled_for: adjustedJ7Date.toISOString(),
      status: "pending",
    });

    // J+20: Cold evaluation
    const j20Date = new Date(now);
    j20Date.setDate(j20Date.getDate() + 20);
    j20Date.setHours(10, 0, 0, 0);
    const adjustedJ20Date = adjustToWorkingDay(j20Date);

    await supabase.from("scheduled_emails").insert({
      training_id: training.id,
      participant_id: evaluation.participant_id,
      email_type: "cold_evaluation",
      scheduled_for: adjustedJ20Date.toISOString(),
      status: "pending",
    });

    // ========================================
    // 6. Special case: Facilitation graphique
    // ========================================
    if (trainingName.toLowerCase().includes("facilitation graphique")) {
      console.log("Sending special Facilitation Graphique email...");

      const fgEmailHtml = `
        <p>${greetingFirstName}</p>
        <p>Je te remercie pour ton évaluation. Pour avoir accès aux supports de la formation en ligne, voici un code de remise : <strong>FG4FREE</strong>, ce qui te permet d'avoir accès à la formation Facilitateur graphique gratuitement. Ce code est aussi valable sur l'offre Facilitateur graphique coaché.</p>
        <p>Voici les étapes à suivre pour utiliser ton code :</p>
        <ol>
          <li>Rends-toi sur <a href="https://supertilt.fr/boutique/formation-en-ligne-facilitation-graphique-offre-facilitateur-graphique-en-herbe/">https://supertilt.fr/boutique/formation-en-ligne-facilitation-graphique-offre-facilitateur-graphique-en-herbe/</a></li>
          <li>Si tu veux la formation gratuite, choisis le pack "Facilitateur graphique"</li>
          <li>Si tu veux 1h30 de coaching visuel, choisis le pack Facilitateur graphique coaché, tu auras une remise de 249€</li>
          <li>Clique sur "S'inscrire"</li>
          <li>Sur la page de la commande en haut tu trouveras un lien "Cliquez ici pour entrer votre code"</li>
          <li>Ajoute le code <strong>FG4FREE</strong></li>
          <li>Ton panier est mis à jour avec le code promo</li>
          <li>Saisis tes informations normalement comme tu le ferais sur n'importe quel site marchand</li>
          <li>Après la confirmation de ta commande, tu recevras un mail qui t'indiquera comment accéder à la formation</li>
        </ol>
        <p>Et voilà :-) Si tu as le moindre souci, demande-moi</p>
        <p><em>Ce code n'est valable que pour toi. En cas d'utilisation de ce code par une autre personne que toi, les accès seraient retirés.</em></p>
        <p>Je te souhaite une belle journée et à bientôt !</p>
        ${signatureHtml}
      `;

      await resend.emails.send({
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [email],
        bcc: ["romain@supertilt.fr", "supertilt@bcc.nocrm.io"],
        subject: `Ton accès à la formation en ligne à la Facilitation Graphique`,
        html: fgEmailHtml,
      });
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      action_type: "evaluation_processed",
      recipient_email: email,
      details: {
        evaluation_id: evaluationId,
        training_id: training.id,
        training_name: trainingName,
        certificate_drive_url: driveUrl || null,
        participant_name: fullName,
      },
    });

    console.log("Evaluation processing complete!");

    return new Response(
      JSON.stringify({
        success: true,
        certificateUrl: driveUrl || pdfUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error processing evaluation:", error);

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
