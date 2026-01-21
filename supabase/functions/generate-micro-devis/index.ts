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

  const formatCurrentDate = (): string => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Calculate totals
  const prixFormation = data.prix * data.nbParticipants;
  const fraisDossier = data.fraisDossier ? 150 : 0;
  const totalHT = prixFormation + fraisDossier;
  const tva = data.isAdministration ? 0 : totalHT * 0.2;
  const totalTTC = totalHT + tva;

  const payload = {
    nom_client: data.nomClient,
    adresse_client: data.adresseClient,
    code_postal_client: data.codePostalClient,
    ville_client: data.villeClient,
    pays: data.pays,
    adresse_commanditaire: data.adresseCommanditaire,
    formation_demandee: data.formationDemandee,
    date_formation: data.dateFormation,
    lieu: data.lieu,
    duree_heures: data.dureeHeures,
    nb_participants: data.nbParticipants,
    prix_unitaire: data.prix,
    prix_formation: prixFormation,
    frais_dossier: fraisDossier,
    total_ht: totalHT,
    tva: tva,
    total_ttc: totalTTC,
    is_administration: data.isAdministration,
    subrogation_paiement: subrogation ? "Oui" : "Non",
    note_devis: data.noteDevis,
    include_cadeau: data.includeCadeau,
    date_devis: formatCurrentDate(),
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

  // Download both PDFs
  const [pdfSansSubrogation, pdfAvecSubrogation] = await Promise.all([
    fetch(pdfUrlSansSubrogation).then(r => r.arrayBuffer()),
    fetch(pdfUrlAvecSubrogation).then(r => r.arrayBuffer()),
  ]);

  const programmeLink = programmeUrl 
    ? `<p>Le programme de la formation est disponible en <a href="${programmeUrl}" style="color: #2563eb; text-decoration: underline;">consultation et téléchargement ici</a>.</p>`
    : '';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p>Bonjour ${adresseCommanditaire},</p>
      
      <p>Merci pour votre demande concernant la formation <strong>"${formationDemandee}"</strong>.</p>
      
      <p>Nous avons bien pris en compte votre besoin et vous trouverez en pièces jointes deux versions de notre devis :</p>
      
      <ul style="margin: 15px 0; padding-left: 20px;">
        <li><strong>Devis sans subrogation de paiement</strong> : vous réglez directement la formation</li>
        <li><strong>Devis avec subrogation de paiement</strong> : votre OPCO règle directement la formation</li>
      </ul>
      
      ${programmeLink}
      
      <p>N'hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.</p>
      
      <p style="margin-top: 30px;"><em>À très bientôt,</em></p>
      
      <p style="margin-top: 20px;">
        <strong>L'équipe Supertilt</strong><br>
        <span style="color: #666;">Formation & Innovation Pédagogique</span>
      </p>
    </div>
  `;

  const emailResponse = await resend.emails.send({
    from: "Supertilt <contact@supertilt.fr>",
    to: [emailCommanditaire],
    subject: `Votre devis pour la formation "${formationDemandee}"`,
    html: htmlContent,
    attachments: [
      {
        filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_sans_subrogation.pdf`,
        content: base64Encode(pdfSansSubrogation),
      },
      {
        filename: `Devis_${formationDemandee.replace(/[^a-zA-Z0-9]/g, '_')}_avec_subrogation.pdf`,
        content: base64Encode(pdfAvecSubrogation),
      },
    ],
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
