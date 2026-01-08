import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { zipSync } from "https://esm.sh/fflate@0.8.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Participant {
  prenom: string;
  nom: string;
  email: string;
}

interface RequestBody {
  formationName: string;
  entreprise: string;
  duree: string;
  userId?: string; // For OAuth token lookup
  dateDebut: string;
  dateFin: string;
  emailDestinataire: string;
  emailCommanditaire?: string;
  participants: Participant[];
}

interface PdfData {
  fileName: string;
  pdfBuffer: Uint8Array;
}

const PDFMONKEY_TEMPLATE_ID = "6593BDA5-6890-45E8-804F-77488D64BEDF";

// Generate PDF with PDF Monkey
async function generatePdfWithPdfMonkey(
  participant: Participant,
  formationName: string,
  entreprise: string,
  duree: string,
  dateDebut: string,
  dateFin: string
): Promise<{ pdfUrl: string; documentId: string }> {
  const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
  
  if (!pdfMonkeyApiKey) {
    throw new Error("PDFMONKEY_API_KEY is not set");
  }

  console.log(`Generating PDF for ${participant.prenom} ${participant.nom}...`);

  // Format dates for PDF
  const formatDateFr = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const formatCurrentDate = (): string => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Build date range string - format: "date début au date fin"
  const dateFormation = `${formatDateFr(dateDebut)} au ${formatDateFr(dateFin)}`;

  const payload = {
    STAGIAIRE: `${participant.prenom} ${participant.nom}`,
    ENTREPRISE: entreprise,
    TITRE_FORMATION: formationName,
    DATE_FORMATION: dateFormation,
    DUREE: duree,
    _date: formatCurrentDate(),
    lineItems: [{}],
  };

  console.log(`PDF Monkey payload:`, JSON.stringify(payload));

  // Create document
  const createResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${pdfMonkeyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      document: {
        document_template_id: PDFMONKEY_TEMPLATE_ID,
        payload: payload,
        status: "pending",
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("PDF Monkey create error:", errorText);
    throw new Error(`Failed to create PDF document: ${errorText}`);
  }

  const createData = await createResponse.json();
  const documentId = createData.document.id;
  console.log(`Document created with ID: ${documentId}`);

  // Poll for completion
  let pdfUrl = "";
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${documentId}`, {
      headers: {
        "Authorization": `Bearer ${pdfMonkeyApiKey}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error("Failed to check document status");
    }

    const statusData = await statusResponse.json();
    console.log(`Document status: ${statusData.document.status}`);

    if (statusData.document.status === "success") {
      pdfUrl = statusData.document.download_url;
      break;
    } else if (statusData.document.status === "failure") {
      throw new Error(`PDF generation failed: ${statusData.document.failure_cause}`);
    }

    attempts++;
  }

  if (!pdfUrl) {
    throw new Error("PDF generation timed out");
  }

  console.log(`PDF generated successfully: ${pdfUrl}`);
  return { pdfUrl, documentId };
}

// Get OAuth access token from stored refresh token
async function getOAuthAccessToken(userId: string): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get stored tokens
  const { data: tokenData, error } = await supabase
    .from("google_drive_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    console.log("No OAuth tokens found for user:", userId);
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(tokenData.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    console.log("Using existing access token");
    return tokenData.access_token;
  }

  // Token expired, refresh it
  console.log("Access token expired, refreshing...");

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    console.error("OAuth credentials not configured");
    return null;
  }

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const refreshData = await refreshResponse.json();

  if (!refreshResponse.ok || !refreshData.access_token) {
    console.error("Token refresh failed:", refreshData);
    return null;
  }

  // Update stored token
  const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();

  await supabase
    .from("google_drive_tokens")
    .update({
      access_token: refreshData.access_token,
      token_expires_at: newExpiresAt,
    })
    .eq("user_id", userId);

  console.log("Access token refreshed successfully");
  return refreshData.access_token;
}

// Format date as YYYY-MM-DD
function formatDateForFileName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Upload to Google Drive using OAuth
async function uploadToGoogleDrive(
  pdfUrl: string,
  participantNom: string,
  participantPrenom: string,
  userId?: string
): Promise<string> {
  try {
    if (!userId) {
      console.log("No userId provided, skipping Google Drive upload");
      return "";
    }

    const accessToken = await getOAuthAccessToken(userId);
    if (!accessToken) {
      console.log("No valid OAuth token, skipping Google Drive upload");
      return "";
    }

    console.log("Using OAuth token for Google Drive upload");
    
    const pdfResponse = await fetch(pdfUrl);
    const pdfBlob = await pdfResponse.blob();
    
    // Find or create folder structure
    const formationsFolderId = await findOrCreateFolder(accessToken, "Formations", "root");
    const certificatsFolderId = await findOrCreateFolder(accessToken, "Certificats", formationsFolderId);
    
    // Build file name: YYYY-MM-DD_Certificat_Nom_Prénom.pdf
    const datePrefix = formatDateForFileName();
    const fileName = `${datePrefix}_Certificat_${participantNom}_${participantPrenom}.pdf`;
    
    // Upload file
    const metadata = {
      name: fileName,
      parents: [certificatsFolderId],
    };

    const formData = new FormData();
    formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    formData.append("file", pdfBlob);

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    const uploadResponseStatus = uploadResponse.status;
    const uploadResponseText = await uploadResponse.text();
    console.log(`Drive upload response status: ${uploadResponseStatus}`);
    console.log(`Drive upload response body: ${uploadResponseText}`);

    if (!uploadResponse.ok) {
      console.error("Drive upload error:", uploadResponseText);
      throw new Error(`Failed to upload to Google Drive: ${uploadResponseStatus} - ${uploadResponseText}`);
    }

    const uploadData = JSON.parse(uploadResponseText);
    console.log(`File uploaded to Drive successfully: ${uploadData.id}`);
    return uploadData.id;
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return "";
  }
}


// Escape single quotes for Google Drive API queries
function escapeForDriveQuery(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Escape HTML special characters for email content
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId: string): Promise<string> {
  // Escape folder name for query
  const escapedFolderName = escapeForDriveQuery(folderName);
  
  // Search for existing folder
  const query = parentId === "root"
    ? `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
    : `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId === "root" ? undefined : [parentId],
    }),
  });

  const createData = await createResponse.json();
  console.log(`Created folder ${folderName}: ${createData.id}`);
  return createData.id;
}

// Send email with Resend API
async function sendEmailWithResend(
  participantEmail: string,
  participantName: string,
  formationName: string,
  pdfUrl: string,
  emailDestinataire: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  // Download PDF for attachment
  const pdfResponse = await fetch(pdfUrl);
  const pdfBuffer = await pdfResponse.arrayBuffer();
  const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

  const fileName = `Certificat_${formationName.replace(/\s+/g, "_")}_${participantName.replace(/\s+/g, "_")}.pdf`;

  console.log(`Sending email to ${participantEmail}...`);

  // HTML-escape user-provided data
  const safeParticipantName = escapeHtml(participantName);
  const safeFormationName = escapeHtml(formationName);

  // Send to participant
  const participantEmailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [participantEmail],
      subject: `Ton certificat de réalisation pour la formation ${formationName}`,
      html: `
        <p>Bonjour ${safeParticipantName},</p>
        <p>Tu trouveras en pièce jointe ton certificat de réalisation pour la formation ${safeFormationName}.</p>
        <p>Je te souhaite de bien exploiter tout ce que tu as vu pendant la formation !</p>
        <p>Si tu souhaites aller plus loin, je t'invite à te rendre régulièrement sur <a href="https://www.supertilt.fr">www.supertilt.fr</a> et à consulter ma <a href="https://www.youtube.com/@supertilt">chaîne YouTube</a>.</p>
        <p>Bonne continuation et à bientôt !</p>
        <p>--</p>
        <p><strong>Romain Couturier</strong><br>
        Expert en agilité et gestion du temps, facilitateur graphique et facilitateur d'intelligence collective<br>
        06 66 98 76 35<br>
        <a href="https://www.supertilt.fr">www.supertilt.fr</a></p>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!participantEmailResponse.ok) {
    const errorText = await participantEmailResponse.text();
    console.error("Resend error:", errorText);
    throw new Error(`Failed to send email: ${errorText}`);
  }

  // Send copy to admin
  if (emailDestinataire && emailDestinataire !== participantEmail) {
    const safeParticipantEmail = escapeHtml(participantEmail);
    
    const adminEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Romain Couturier <romain@supertilt.fr>",
        to: [emailDestinataire],
        subject: `[Copie] Certificat envoyé à ${participantName} - ${formationName}`,
        html: `
          <h1>Certificat envoyé</h1>
          <p>Le certificat de formation a été envoyé à <strong>${safeParticipantName}</strong> (${safeParticipantEmail}).</p>
          <p><strong>Formation :</strong> ${safeFormationName}</p>
          <p>Une copie du certificat est jointe à cet email.</p>
        `,
        attachments: [
          {
            filename: fileName,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!adminEmailResponse.ok) {
      console.warn("Failed to send admin copy email");
    }
  }

  console.log(`Email sent successfully to ${participantEmail}`);
}

// Send ZIP archive to commanditaire
async function sendZipToCommanditaire(
  emailCommanditaire: string,
  formationName: string,
  pdfDataList: PdfData[]
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  console.log(`Creating ZIP with ${pdfDataList.length} certificates for commanditaire...`);

  // Create ZIP file
  const zipFiles: { [key: string]: Uint8Array } = {};
  for (const pdfData of pdfDataList) {
    zipFiles[pdfData.fileName] = pdfData.pdfBuffer;
  }
  
  const zipBuffer = zipSync(zipFiles);
  const zipBase64 = btoa(String.fromCharCode(...zipBuffer));
  
  const zipFileName = `Certificats_${formationName.replace(/\s+/g, "_")}.zip`;

  console.log(`Sending ZIP to commanditaire: ${emailCommanditaire} (BCC: romain@supertilt.fr)`);

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Romain Couturier <romain@supertilt.fr>",
      to: [emailCommanditaire],
      bcc: ["romain@supertilt.fr"],
      subject: `Certificats de réalisation - Formation ${formationName}`,
      html: `
        <p>Bonjour,</p>
        <p>Veuillez trouver ci-joint l'ensemble des certificats de réalisation pour la formation <strong>${formationName}</strong>.</p>
        <p>Cette archive contient ${pdfDataList.length} certificat(s).</p>
        <p>Cordialement,</p>
        <p>--</p>
        <p><strong>Romain Couturier</strong><br>
        Expert en agilité et gestion du temps, facilitateur graphique et facilitateur d'intelligence collective<br>
        06 66 98 76 35<br>
        <a href="https://www.supertilt.fr">www.supertilt.fr</a></p>
      `,
      attachments: [
        {
          filename: zipFileName,
          content: zipBase64,
        },
      ],
    }),
  });

  if (!emailResponse.ok) {
    const errorText = await emailResponse.text();
    console.error("Failed to send ZIP to commanditaire:", errorText);
    throw new Error(`Failed to send ZIP: ${errorText}`);
  }

  console.log(`ZIP sent successfully to ${emailCommanditaire}`);
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { formationName, entreprise, duree, dateDebut, dateFin, emailDestinataire, emailCommanditaire, participants, userId } = body;

    console.log(`Processing ${participants.length} participants for formation: ${formationName}`);
    if (userId) {
      console.log(`User ID provided for OAuth: ${userId}`);
    }

    if (emailCommanditaire) {
      console.log(`Will send ZIP to commanditaire: ${emailCommanditaire}`);
    }

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const pdfDataList: PdfData[] = [];
        let successCount = 0;

        // Helper to send a streaming event
        const sendEvent = (event: { type: string; data: any }) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        // Send initial event
        sendEvent({ type: "start", data: { total: participants.length } });

        for (let i = 0; i < participants.length; i++) {
          const participant = participants[i];
          const participantName = `${participant.prenom} ${participant.nom}`;
          let pdfUrl = "";
          let pdfGenerated = false;
          const errors: string[] = [];

          // Notify PDF generation started
          sendEvent({ 
            type: "step", 
            data: { 
              participant: participantName, 
              step: "pdf", 
              status: "pending",
              message: "Génération du PDF en cours..." 
            } 
          });

          try {
            // Generate PDF
            const result = await generatePdfWithPdfMonkey(
              participant,
              formationName,
              entreprise,
              duree,
              dateDebut,
              dateFin
            );
            pdfUrl = result.pdfUrl;
            pdfGenerated = true;

            sendEvent({ 
              type: "step", 
              data: { 
                participant: participantName, 
                step: "pdf", 
                status: "success",
                message: "PDF généré avec succès" 
              } 
            });
          } catch (error: any) {
            console.error(`PDF error for ${participantName}:`, error);
            errors.push(`PDF: ${error.message}`);
            sendEvent({ 
              type: "step", 
              data: { 
                participant: participantName, 
                step: "pdf", 
                status: "error",
                message: `Erreur: ${error.message}` 
              } 
            });
          }

          if (pdfGenerated && pdfUrl) {
            // Download PDF for ZIP if commanditaire email is set
            if (emailCommanditaire) {
              try {
                const pdfResponse = await fetch(pdfUrl);
                const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
                const fileName = `Certificat_${participant.prenom}_${participant.nom}.pdf`;
                pdfDataList.push({ fileName, pdfBuffer });
              } catch (error: any) {
                console.warn(`Failed to download PDF for ZIP: ${error.message}`);
              }
            }

            // Upload to Google Drive
            sendEvent({ 
              type: "step", 
              data: { 
                participant: participantName, 
                step: "drive", 
                status: "pending",
                message: "Upload sur Google Drive..." 
              } 
            });

            try {
              await uploadToGoogleDrive(pdfUrl, participant.nom, participant.prenom, userId);
              sendEvent({ 
                type: "step", 
                data: { 
                  participant: participantName, 
                  step: "drive", 
                  status: "success",
                  message: "Uploadé sur Google Drive" 
                } 
              });
            } catch (error: any) {
              console.warn(`Drive upload failed for ${participantName}:`, error.message);
              sendEvent({ 
                type: "step", 
                data: { 
                  participant: participantName, 
                  step: "drive", 
                  status: "error",
                  message: "Échec upload Drive (non bloquant)" 
                } 
              });
            }

            // Send email
            sendEvent({ 
              type: "step", 
              data: { 
                participant: participantName, 
                step: "email", 
                status: "pending",
                message: "Envoi de l'email..." 
              } 
            });

            try {
              await sendEmailWithResend(
                participant.email,
                participantName,
                formationName,
                pdfUrl,
                emailDestinataire
              );
              sendEvent({ 
                type: "step", 
                data: { 
                  participant: participantName, 
                  step: "email", 
                  status: "success",
                  message: "Email envoyé" 
                } 
              });
            } catch (error: any) {
              console.warn(`Email failed for ${participantName}:`, error.message);
              errors.push(`Email: ${error.message}`);
              sendEvent({ 
                type: "step", 
                data: { 
                  participant: participantName, 
                  step: "email", 
                  status: "error",
                  message: `Erreur email: ${error.message}` 
                } 
              });
            }
          }

          // Send participant completion
          const success = pdfGenerated;
          if (success) successCount++;
          
          sendEvent({ 
            type: "participant_done", 
            data: { 
              participant: participantName, 
              success,
              index: i + 1,
              total: participants.length,
              error: errors.length > 0 ? errors.join("; ") : undefined
            } 
          });
        }

        // Send ZIP to commanditaire if email is set and we have PDFs
        if (emailCommanditaire && pdfDataList.length > 0) {
          sendEvent({ 
            type: "step", 
            data: { 
              participant: "Commanditaire", 
              step: "email", 
              status: "pending",
              message: `Envoi du ZIP à ${emailCommanditaire}...` 
            } 
          });

          try {
            // Wait 1 second to respect Resend rate limit
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await sendZipToCommanditaire(emailCommanditaire, formationName, pdfDataList);
            
            sendEvent({ 
              type: "step", 
              data: { 
                participant: "Commanditaire", 
                step: "email", 
                status: "success",
                message: `ZIP envoyé à ${emailCommanditaire}` 
              } 
            });
          } catch (error: any) {
            console.error(`Failed to send ZIP to commanditaire: ${error.message}`);
            sendEvent({ 
              type: "step", 
              data: { 
                participant: "Commanditaire", 
                step: "email", 
                status: "error",
                message: `Échec envoi ZIP: ${error.message}` 
              } 
            });
          }
        }

        // Send final completion event
        sendEvent({ 
          type: "complete", 
          data: { 
            successCount,
            totalCount: participants.length,
            message: `${successCount} certificat(s) généré(s) avec succès`
          } 
        });

        console.log(`Completed: ${successCount}/${participants.length} certificates generated successfully`);
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("Error in generate-certificates function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
