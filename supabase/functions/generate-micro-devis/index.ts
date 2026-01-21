import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  isAdministration: boolean;
  noteDevis: string;
  formationDemandee: string;
  dateFormation: string;
  lieu: string;
  includeCadeau: boolean;
  fraisDossier: boolean;
  prix: number;
  dureeHeures: number;
  programmeUrl: string | null;
  nbParticipants: number;
  participants: string; // Liste des participants (texte brut)
}

const PDFMONKEY_TEMPLATE_ID = "C3BC00C9-232F-4ADD-9D1F-9FD176573E93";

async function generatePdfWithPdfMonkey(
  data: RequestBody,
  subrogation: boolean
): Promise<{ pdfUrl: string; documentId: string }> {
  const pdfMonkeyApiKey = Deno.env.get("PDFMONKEY_API_KEY");
  
  if (!pdfMonkeyApiKey) {
    throw new Error("PDFMONKEY_API_KEY is not set");
  }

  console.log(`Generating PDF with subrogation=${subrogation}...`);

  // Parse participants list
  const participantsList = data.participants
    .split(/[,;\n]/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // Build cadeau text if included
  const cadeauText = data.includeCadeau 
    ? "Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation en facilitation graphique"
    : "";

  // Build the payload in the expected structure
  const payload = {
    client: {
      name: data.nomClient,
      address: data.adresseClient,
      zip: data.codePostalClient,
      city: data.villeClient,
      country: data.pays,
    },
    note: data.noteDevis || "",
    affiche_frais: data.fraisDossier ? "Oui" : "Non",
    subrogation: subrogation ? "Oui" : "Non",
    cadeau: cadeauText,
    items: [
      {
        name: data.formationDemandee,
        participant_name: participantsList.length > 0 ? participantsList : [`${data.adresseCommanditaire} ${data.emailCommanditaire}`],
        date: data.dateFormation,
        place: data.lieu,
        duration: `${data.dureeHeures}h`,
        quantity: data.nbParticipants,
        unit_price: data.prix,
      },
    ],
    admin_fee: data.fraisDossier ? 150 : 0,
    is_administration: data.isAdministration,
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
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const statusResponse = await fetch(
      `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
      {
        headers: {
          "Authorization": `Bearer ${pdfMonkeyApiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check document status`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.document.status;
    
    console.log(`Document status: ${status}`);

    if (status === "success") {
      const pdfUrl = statusData.document.download_url;
      console.log(`PDF ready: ${pdfUrl}`);
      return { pdfUrl, documentId };
    } else if (status === "failure") {
      throw new Error(`PDF generation failed: ${statusData.document.failure_cause}`);
    }

    attempts++;
  }

  throw new Error("PDF generation timed out");
}

async function sendEmailWithResend(
  emailCommanditaire: string,
  adresseCommanditaire: string,
  formationDemandee: string,
  programmeUrl: string | null,
  pdfUrlSansSubrogation: string,
  pdfUrlAvecSubrogation: string
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const resend = new Resend(resendApiKey);

  console.log(`Sending email to ${emailCommanditaire}...`);

  // Fetch Signitic signature for romain@supertilt.fr
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");
  let emailSignature = "";
  
  if (signiticApiKey) {
    try {
      const signatureResponse = await fetch(
        "https://api.signitic.app/signatures/romain@supertilt.fr/html",
        {
          headers: {
            "x-api-key": signiticApiKey,
          },
        }
      );
      
      if (signatureResponse.ok) {
        const signatureData = await signatureResponse.json();
        if (signatureData.success && signatureData.html) {
          emailSignature = signatureData.html;
          console.log("Signitic signature fetched successfully");
        }
      } else {
        console.warn("Could not fetch Signitic signature:", signatureResponse.status);
      }
    } catch (error) {
      console.warn("Error fetching Signitic signature:", error);
    }
  }

  // Download PDFs
  const [pdfSansSubrogation, pdfAvecSubrogation] = await Promise.all([
    fetch(pdfUrlSansSubrogation).then(r => r.arrayBuffer()),
    fetch(pdfUrlAvecSubrogation).then(r => r.arrayBuffer()),
  ]);

  // Fetch Qualiopi certificate from public URL
  const qualiopiPublicUrl = "https://id-preview--189bb4e6-abb7-4be6-96a9-7ff350879011.lovable.app/documents/Certificat_QUALIOPI.pdf";
  
  let qualiopiCertificate: ArrayBuffer | null = null;
  try {
    const qualiopiResponse = await fetch(qualiopiPublicUrl);
    if (qualiopiResponse.ok) {
      qualiopiCertificate = await qualiopiResponse.arrayBuffer();
      console.log("Qualiopi certificate fetched successfully");
    } else {
      console.warn("Could not fetch Qualiopi certificate:", qualiopiResponse.status);
    }
  } catch (error) {
    console.warn("Error fetching Qualiopi certificate:", error);
  }

  const programmeLink = programmeUrl 
    ? `<p>Le programme de la formation est disponible en <a href="${programmeUrl}" style="color: #2563eb; text-decoration: underline;">consultation et téléchargement ici</a>.</p>`
    : '';

  // Fallback signature if Signitic fails
  const fallbackSignature = `
    <p style="margin-top: 20px;">
      <strong>Romain</strong><br>
      <span style="color: #666;">Supertilt - Formation & Innovation Pédagogique</span>
    </p>
  `;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>Bonjour ${adresseCommanditaire},</p>
      
      <p>Merci pour votre demande concernant la formation <strong>"${formationDemandee}"</strong>.</p>
      
      <p>Vous trouverez en pièces jointes :</p>
      
      <ul style="margin: 15px 0; padding-left: 20px;">
        <li><strong>Deux versions de notre devis</strong> :
          <ul style="margin: 5px 0; padding-left: 20px;">
            <li>Sans subrogation de paiement : vous réglez directement la formation</li>
            <li>Avec subrogation de paiement : votre OPCO règle directement la formation</li>
          </ul>
        </li>
        <li><strong>Notre certificat Qualiopi</strong>, attestant de la qualité de nos formations</li>
      </ul>
      
      ${programmeLink}
      
      <p>N'hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.</p>
      
      <p style="margin-top: 30px;"><em>À très bientôt,</em></p>
      
      ${emailSignature || fallbackSignature}
    </div>
  `;

  // Remove duplicate "formation" from subject if present
  const formationName = formationDemandee.replace(/^formation\s+/i, "");
  
  // Build attachments array
  const attachments = [
    {
      filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_sans_subrogation.pdf`,
      content: base64Encode(pdfSansSubrogation),
    },
    {
      filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_avec_subrogation.pdf`,
      content: base64Encode(pdfAvecSubrogation),
    },
  ];
  
  // Add Qualiopi certificate if available
  if (qualiopiCertificate) {
    attachments.push({
      filename: "Certificat_Qualiopi_Supertilt.pdf",
      content: base64Encode(qualiopiCertificate),
    });
  }
  
  const emailResponse = await resend.emails.send({
    from: "Supertilt <romain@supertilt.fr>",
    to: [emailCommanditaire],
    subject: `Votre devis pour la formation "${formationName}"`,
    html: htmlContent,
    attachments,
  });

  console.log("Email sent successfully:", emailResponse);
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log("Received request:", JSON.stringify(body));

    // Validate required fields
    if (!body.emailCommanditaire || !body.formationDemandee) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PDF without subrogation
    console.log("Generating PDF without subrogation...");
    const pdfSansSubrogation = await generatePdfWithPdfMonkey(body, false);

    // Generate PDF with subrogation
    console.log("Generating PDF with subrogation...");
    const pdfAvecSubrogation = await generatePdfWithPdfMonkey(body, true);

    // Send email with both PDFs
    console.log("Sending email with both PDFs...");
    await sendEmailWithResend(
      body.emailCommanditaire,
      body.adresseCommanditaire,
      body.formationDemandee,
      body.programmeUrl,
      pdfSansSubrogation.pdfUrl,
      pdfAvecSubrogation.pdfUrl
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Devis générés et envoyés avec succès",
        pdfSansSubrogation: pdfSansSubrogation.pdfUrl,
        pdfAvecSubrogation: pdfAvecSubrogation.pdfUrl,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
