import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
  dateDebut: string;
  dateFin: string;
  emailDestinataire: string;
  participants: Participant[];
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

// Google Service Account configuration
const GOOGLE_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "platinum-analog-480215-m0",
  private_key_id: "1878b07f2ec23d8f84d2493ee58f87d6c78ddf5c",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIJ/5aNH2qcDRf
3z8uypOsVKoXKD5oSWPl5Nyhbo5gKwfidL/MQmzyfnP3F5PnZepWu0Og+ojMvVQU
GBfRas+8iwUVFrkA6rTpiGvN25E309cxQo8Xavy7U2fvnN/URHTUVUo7P2Y2Sjp/
pvqTsujJLkD7jq4rB2LJ+eJFyH/feZkIwGB1bdAm7RgoOT2dzxttpqIqYVSRU6JV
bPPWaAH+hLAUplZ69erHbk2OYGq2tsbd/FtgmL23uHKmuruv0u6xhZD5lDDpMBUO
/UgI+ZMZxHNrTE5XF/ZY7rsmkpT15v+4sqPGPl7M6W2ml8RdY1bXOzx+JW8QdzMl
wDOoUTIRAgMBAAECggEAAiHvdBIQU/NeuOLTxtjJxjp12e0jFGJySzJZjn1QH+d1
EO+mbr7XL6XJlsr2wUtkIE0RDa83q4p5nngKGNOLX7M7PR5lK/5KlvzXebQbZeAj
k2efZzJoqF09a6RhyK6IFsfrGt3sWQG1O61f6N76G33uO2Ppq574NlLSBOulRaOY
G28tTvYoBequcFgkHYWYxS/qwTzEP4LIddeiwx2V6nFf5YlqQ3mTUjNvyH+Iuvd0
D+flpveN+AsWzsdLMvBQQkXFM5x3NU/dnzNdmKr9IyeUTvr7rxVWCfYR1BQTwD70
qwoWoHZ6T2m+/DEbTSwQqg7aHG3HUKMIN/Jdke0gIQKBgQD/5wd6hUf3Pl4XfZ1O
GVKlsFqvZFvpr+ZD8XAHHjQynJLNbH8JDHkdMfFWYDTH4ABRW8g+obw8QvSU/bqY
9HVVWnFvh9i2qC2sTksIzaNJslQjcqOmjKr2OMsq1piiUoVtIu6AxRorgL6Df2zM
mKxSO6R5TxyZGif307ipKroEYQKBgQDIO4ZQ3RnStDsBxnT/IFtNODd62V7+ZUIs
L5JA8kbH0wPsLP2vlvncLf3pw0w2xXgSanTpAU88nAONfcZlYacUnjv6epf+tIYh
JR6H1FW2QwWxd4cSbTDCstmDlQOl4tiPWMVv2AlcEJ74YenKAfsebY/7aHOhkgnw
EJaZzgQLsQKBgQC8b+BG7UwgGTHqNFqYfvcoASPWEZ3JB/kUwP4Qj8I6HqfPUvx8
qk2pHPSs+S0EncM+Jcrfq/NToK4/5FL6fNDF6FKtoSgI4PC49/Iy6lI6W3GvpKQz
aVQe+ZVJ1zoQFZog0l80PW/W5vfjFvsD8cy6xSaJGaNibitOR/6ru0W9IQKBgCUZ
ml57SSCYUmKW0fC/nwskwmrZwdcjDeq/+bpc6a52s8Bb6blSIQOh5e0dSY7Qcdn/
rZ/KpVLWmXXq+wqn2FxioTxc4LLJ4hxcE1cZibQWoQRr4DQS1TkOCG1v+9gNuxB8
Y0DA56MOVVYyVi4exdeydz4e8WXbeEnp2O2wlWFRAoGBAIaSRWOmgsGVGxJnH8et
X/8N1cimfEu656wdS5sYLuFIpF/XQ2iNxY552EmBFWCjYH1tp7k2XVfpxx7l99E7
3VO9FUUEwBpwOmGiOEol8lfAQR1acComZujBmUwCbgJlgCC7f6jL7FdsqybzfL8N
kN0N5lq4QKpaW6oXv33cvpeD
-----END PRIVATE KEY-----`,
  client_email: "lovable-drive-uploader@platinum-analog-480215-m0.iam.gserviceaccount.com",
  client_id: "108844887639142954309",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/lovable-drive-uploader%40platinum-analog-480215-m0.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

// Upload to Google Drive
async function uploadToGoogleDrive(
  pdfUrl: string,
  fileName: string
): Promise<string> {
  try {
    console.log("Using embedded service account, client_email:", GOOGLE_SERVICE_ACCOUNT.client_email);
    
    const tokenResponse = await getGoogleAccessToken(GOOGLE_SERVICE_ACCOUNT);
    console.log("Google OAuth token obtained successfully");
    
    const pdfResponse = await fetch(pdfUrl);
    const pdfBlob = await pdfResponse.blob();
    
    // Find or create folder structure
    const formationsFolderId = await findOrCreateFolder(tokenResponse, "Formations", "root");
    const certificatsFolderId = await findOrCreateFolder(tokenResponse, "Certificats", formationsFolderId);
    
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
          Authorization: `Bearer ${tokenResponse}`,
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

async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
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
    encoder.encode(signatureInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signatureInput}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenStatus = tokenResponse.status;
  const tokenData = await tokenResponse.json();
  console.log(`OAuth token response status: ${tokenStatus}`);
  console.log(`OAuth token response:`, JSON.stringify(tokenData));
  
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  
  return tokenData.access_token;
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId: string): Promise<string> {
  // Search for existing folder
  const query = parentId === "root"
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

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
        <p>Bonjour ${participantName},</p>
        <p>Tu trouveras en pièce jointe ton certificat de réalisation pour la formation ${formationName}.</p>
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
          <p>Le certificat de formation a été envoyé à <strong>${participantName}</strong> (${participantEmail}).</p>
          <p><strong>Formation :</strong> ${formationName}</p>
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

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { formationName, entreprise, duree, dateDebut, dateFin, emailDestinataire, participants } = body;

    console.log(`Processing ${participants.length} participants for formation: ${formationName}`);

    const results: { participant: string; success: boolean; error?: string }[] = [];

    for (const participant of participants) {
      let pdfUrl = "";
      let pdfGenerated = false;
      let driveUploaded = false;
      let emailSent = false;
      const errors: string[] = [];

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
      } catch (error: any) {
        console.error(`PDF error for ${participant.prenom} ${participant.nom}:`, error);
        errors.push(`PDF: ${error.message}`);
      }

      if (pdfGenerated && pdfUrl) {
        // Upload to Google Drive (non-blocking)
        try {
          const fileName = `Certificat_${formationName.replace(/\s+/g, "_")}_${participant.prenom}_${participant.nom}.pdf`;
          await uploadToGoogleDrive(pdfUrl, fileName);
          driveUploaded = true;
        } catch (error: any) {
          console.warn(`Drive upload failed for ${participant.prenom} ${participant.nom}:`, error.message);
          // Don't add to errors - Drive is optional
        }

        // Send email (non-blocking for success)
        try {
          await sendEmailWithResend(
            participant.email,
            `${participant.prenom} ${participant.nom}`,
            formationName,
            pdfUrl,
            emailDestinataire
          );
          emailSent = true;
        } catch (error: any) {
          console.warn(`Email failed for ${participant.prenom} ${participant.nom}:`, error.message);
          errors.push(`Email: ${error.message}`);
        }
      }

      results.push({
        participant: `${participant.prenom} ${participant.nom}`,
        success: pdfGenerated,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Completed: ${successCount}/${participants.length} certificates generated successfully`);

    return new Response(
      JSON.stringify({
        message: `${successCount} certificat(s) généré(s) avec succès`,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
