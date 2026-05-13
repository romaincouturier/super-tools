import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  escapeHtml,
} from "../_shared/mod.ts";
import { processTemplate } from "../_shared/templates.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId } = await req.json();
    if (!trainingId) return createErrorResponse("trainingId is required", 400);

    const supabase = getSupabaseClient();

    const { data: training, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();
    if (error || !training) throw new Error("Training not found");

    if (!training.sponsor_email) {
      return createErrorResponse("Aucun email de commanditaire renseigné", 400);
    }

    const { data: schedules } = await supabase
      .from("training_schedules")
      .select("day_date, start_time, end_time")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });

    let trainingDate = "";
    if (schedules && schedules.length > 0) {
      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      if (schedules.length === 1) {
        trainingDate = fmt(schedules[0].day_date);
      } else {
        trainingDate = `du ${fmt(schedules[0].day_date)} au ${fmt(schedules[schedules.length - 1].day_date)}`;
      }
    } else if (training.start_date) {
      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      trainingDate = training.end_date && training.end_date !== training.start_date
        ? `du ${fmt(training.start_date)} au ${fmt(training.end_date)}`
        : fmt(training.start_date);
    }

    const formal = !!training.sponsor_formal_address;
    const suffix = formal ? "vous" : "tu";

    const [bccList, signature] = await Promise.all([
      getBccSettings(supabase),
      getSigniticSignature(),
    ]);

    const { data: tpl } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `request_participants_emails_${suffix}`)
      .maybeSingle();

    const vars = {
      first_name: training.sponsor_first_name || "",
      training_name: training.training_name || "",
      training_date: trainingDate,
      training_location: training.location || "",
    };

    let subject: string;
    let body: string;

    if (tpl) {
      subject = processTemplate(tpl.subject, vars, false);
      body = processTemplate(tpl.html_content, vars, false);
    } else {
      // Fallback default
      subject = `Demande des emails des participants pour la formation ${training.training_name}`;
      const greeting = formal
        ? (training.sponsor_first_name ? `Bonjour ${escapeHtml(training.sponsor_first_name)},` : "Bonjour,")
        : (training.sponsor_first_name ? `Bonjour ${escapeHtml(training.sponsor_first_name)},` : "Bonjour,");
      const verbe = formal ? "vous allez bien. Pourriez-vous" : "tu vas bien. Pourrais-tu";
      const locPart = training.location ? ` à ${escapeHtml(training.location)}` : "";
      body = `${greeting}\n\nJ'espère que ${verbe} me transmettre la liste des emails des participants pour la session "${escapeHtml(training.training_name)}" prévue le ${escapeHtml(trainingDate)}${locPart} ?\n\nMerci d'avance et bonne journée.`;
    }

    const html = body
      .split(/\n\n+/)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("") + "\n" + signature;

    const result = await sendEmail({
      to: [training.sponsor_email],
      bcc: bccList,
      subject,
      html,
      _emailType: "request_participants_emails",
      _trainingId: trainingId,
    });

    if (!result.success) throw new Error(`Failed to send email: ${result.error}`);

    return createJsonResponse({ success: true, messageId: result.id });
  } catch (e: unknown) {
    console.error("Error in send-participants-emails-request:", e);
    return createErrorResponse(e instanceof Error ? e.message : "Failed to send");
  }
});
