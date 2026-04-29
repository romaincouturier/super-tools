import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  processTemplate,
  textToHtml,
  wrapEmailHtml,
} from "../_shared/mod.ts";

const DEFAULT_SUBJECT = "Vos livrables sont disponibles - {{mission_title}}";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont prêts pour toi.

Tu peux les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont disponibles.

Vous pouvez les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésitez pas à revenir vers moi si vous avez la moindre question.

Cordialement,`;

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { mission_id, recipients, subject } = await req.json();

    if (!mission_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return createErrorResponse("mission_id and recipients[] are required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch mission title
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("title")
      .eq("id", mission_id)
      .single();

    if (missionError || !mission) {
      return createErrorResponse("Mission not found", 404);
    }

    const missionTitle = mission.title;
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const baseUrl = urls.app_url;
    const deliverablesLink = `${baseUrl}/mission-info/${mission_id}`;

    // Fetch custom templates for both modes
    const { data: customTemplates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content")
      .in("template_type", ["mission_deliverables_tu", "mission_deliverables_vous"]);

    const customTu = customTemplates?.find((t: any) => t.template_type === "mission_deliverables_tu");
    const customVous = customTemplates?.find((t: any) => t.template_type === "mission_deliverables_vous");

    // Fetch BCC and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(),
      getSigniticSignature(),
    ]);

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      const { email, first_name, formal_address } = recipient;
      if (!email) continue;

      // Tutoiement par défaut, vouvoiement uniquement si formal_address = true
      const useTu = !formal_address;
      const custom = useTu ? customTu : customVous;
      const defaultContent = useTu ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;

      const subjectTemplate = subject || custom?.subject || DEFAULT_SUBJECT;
      const contentTemplate = custom?.html_content || defaultContent;

      const variables = {
        first_name: first_name || "",
        mission_title: missionTitle,
        deliverables_link: deliverablesLink,
      };

      const processedSubject = processTemplate(subjectTemplate, variables, false);
      const contentText = processTemplate(contentTemplate, variables, false);

      // Check if template already contains HTML tags
      const hasHtml = /<[a-z][\s\S]*>/i.test(contentText);
      // For mixed content (HTML + plain text), convert remaining newlines to <br>
      // For pure plain text, use full textToHtml conversion
      const contentHtml = hasHtml
        ? contentText.split(/\n\n+/).map((p: string) => {
            if (/<[a-z][\s\S]*>/i.test(p)) return p;
            const lines = p.split(/\n/).map((l: string) => l.trim()).filter(Boolean);
            return `<p>${lines.join("<br>")}</p>`;
          }).join("")
        : textToHtml(contentText);

      const fullHtml = wrapEmailHtml(contentHtml, signature);

      console.log("Sending deliverables email to:", email);

      const result = await sendEmail({
        to: [email],
        bcc: bccList,
        subject: processedSubject,
        html: fullHtml,
        _emailType: "mission_deliverables",
      });

      results.push({ email, success: result.success, error: result.error });

      // Rate limit: 600ms between emails
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Deliverables emails sent: ${successCount}/${results.length}`);

    return createJsonResponse({
      success: true,
      sent: successCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in send-mission-deliverables:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});
