import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  trainingId: string;
  conventionUrl: string;
  recipientEmail: string;
  recipientName?: string;
  recipientFirstName?: string;
  formalAddress?: boolean;
  conventionFileName?: string;
}

function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const {
      trainingId,
      conventionUrl,
      recipientEmail,
      recipientName,
      recipientFirstName,
      formalAddress = true,
      conventionFileName,
    } = body;

    if (!trainingId || !conventionUrl || !recipientEmail) {
      return new Response(
        JSON.stringify({ error: "trainingId, conventionUrl et recipientEmail sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch training details
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, start_date, end_date")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return new Response(
        JSON.stringify({ error: "Formation introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine template type based on formal address
    const templateType = formalAddress ? "convention_vous" : "convention_tu";

    // Fetch email template
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", templateType)
      .eq("is_default", true)
      .maybeSingle();

    const startDateFormatted = formatDateFr(training.start_date);
    const endDateFormatted = training.end_date
      ? formatDateFr(training.end_date)
      : startDateFormatted;
    const firstName = recipientFirstName || recipientName || "";

    // Build subject and body from template (or defaults)
    let subject = template?.subject || `Convention de formation - ${training.training_name}`;
    let htmlBody = template?.html_content || `<p>Bonjour,</p><p>Veuillez trouver ci-joint la convention de formation.</p>`;

    // Replace template variables
    const replacements: Record<string, string> = {
      "{{first_name}}": firstName,
      "{{training_name}}": training.training_name,
      "{{start_date}}": startDateFormatted,
      "{{end_date}}": endDateFormatted,
    };

    for (const [key, value] of Object.entries(replacements)) {
      subject = subject.replaceAll(key, value);
      htmlBody = htmlBody.replaceAll(key, value);
    }

    // Get signature and BCC
    const [signature, bccList] = await Promise.all([
      getSigniticSignature(),
      getBccSettings(supabase),
    ]);

    const fullHtml = `${htmlBody}${signature}`;

    // Download the PDF to attach it
    console.log("Downloading convention PDF from:", conventionUrl);
    const pdfResponse = await fetch(conventionUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Impossible de télécharger la convention: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Convert to base64 in chunks to avoid stack overflow
    const CHUNK_SIZE = 8192;
    let binaryStr = "";
    for (let i = 0; i < pdfBytes.length; i += CHUNK_SIZE) {
      const chunk = pdfBytes.slice(i, i + CHUNK_SIZE);
      binaryStr += String.fromCharCode(...chunk);
    }
    const pdfBase64 = btoa(binaryStr);

    const fileName = conventionFileName || "Convention_de_formation.pdf";

    // Send email with attachment
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html: fullHtml,
      bcc: bccList,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    });

    if (!result.success) {
      throw new Error(result.error || "Erreur d'envoi de l'email");
    }

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "convention_email_sent",
        recipient_email: recipientEmail,
        details: {
          training_id: trainingId,
          training_name: training.training_name,
          convention_url: conventionUrl,
          recipient_name: recipientName,
          email_id: result.id,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    console.log(`Convention email sent to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
