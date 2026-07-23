import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  getSigniticSignature,
  replaceVariables,
  formatDateFr,
  wrapEmailHtml,
  sendEmail,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { getAppUrls } from "../_shared/app-urls.ts";

// Same helper used in send-elearning-access
function formatContentToHtml(content: string): string {
  const blocks = content.split(/\n\n+/);
  return blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(p|div|table|ol|ul|h[1-6])\b/i.test(trimmed)) return trimmed;
    const lines = trimmed.split(/\n/).map(l => l.trim()).join("<br>");
    return `<p>${lines}</p>`;
  }).filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, trainingId } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();

    // Check participant exists (silent fail for security)
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name, training_id")
      .ilike("email", email);

    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un lien vous a été envoyé." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch training details
    let trainingName: string | null = null;
    let startDateRaw: string | null = null;
    let endDateRaw: string | null = null;
    let isTu = false;
    let trainingsListHtml = "";
    if (trainingId) {
      const { data: training } = await supabase
        .from("trainings")
        .select("training_name, start_date, end_date, sponsor_formal_address")
        .eq("id", trainingId)
        .maybeSingle();
      trainingName = training?.training_name ?? null;
      startDateRaw = training?.start_date ?? null;
      endDateRaw = training?.end_date ?? null;
      isTu = !training?.sponsor_formal_address;
    } else {
      // Self-service: aggregate all trainings this participant is enrolled in
      const trainingIds = Array.from(
        new Set(participants.map((p: any) => p.training_id).filter(Boolean))
      );
      if (trainingIds.length > 0) {
        const { data: trainings } = await supabase
          .from("trainings")
          .select("training_name, start_date, end_date, sponsor_formal_address")
          .in("id", trainingIds)
          .order("start_date", { ascending: false });
        if (trainings && trainings.length > 0) {
          // Use "vous" by default unless all trainings are "tu"
          isTu = trainings.every((t: any) => !t.sponsor_formal_address);
          if (trainings.length === 1) {
            trainingName = trainings[0].training_name;
            startDateRaw = trainings[0].start_date;
            endDateRaw = trainings[0].end_date;
          } else {
            const items = trainings.map((t: any) => {
              const s = t.start_date ? formatDateFr(t.start_date) : "";
              const e = t.end_date ? formatDateFr(t.end_date) : "";
              const dateStr = s && e && s !== e ? ` (${s} → ${e})` : s ? ` (${s})` : "";
              return `<li><strong>${t.training_name ?? ""}</strong>${dateStr}</li>`;
            }).join("");
            trainingsListHtml = `<ul>${items}</ul>`;
            trainingName = null;
          }
        }
      }
    }

    // 1-year expiry
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const insertPayload: Record<string, unknown> = {
      email: email.toLowerCase(),
      expires_at: expiresAt.toISOString(),
    };
    if (trainingId) insertPayload.training_id = trainingId;

    const { data: link, error } = await supabase
      .from("learner_magic_links")
      .insert(insertPayload)
      .select("token")
      .single();

    if (error) throw error;

    const urls = await getAppUrls();
    const accessLink = `${urls.app_url}/apprenant/connexion?token=${link.token}`;
    const firstName = participants[0].first_name || "";

    // Prefer dedicated magic-link template; fall back to the woocommerce one if not present
    const primaryType = isTu ? "elearning_magic_link_tu" : "elearning_magic_link_vous";
    const fallbackType = isTu ? "elearning_access_tu" : "elearning_access_vous";
    let { data: template } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", primaryType)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!template) {
      const { data: fb } = await supabase
        .from("email_templates")
        .select("subject, html_content")
        .eq("template_type", fallbackType)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      template = fb;
    }

    const startDateFr = startDateRaw ? formatDateFr(startDateRaw) : "";
    const endDateFr = endDateRaw ? formatDateFr(endDateRaw) : "";

    let subject: string;
    let bodyContent: string;

    const hasMultiple = !!trainingsListHtml;
    const displayName = trainingName ?? (hasMultiple ? "vos formations" : "votre formation");

    if (template && !hasMultiple) {
      // Single training — use DB template
      subject = replaceVariables(template.subject, {
        training_name: displayName,
        first_name: firstName,
      });
      bodyContent = replaceVariables(template.html_content, {
        first_name: firstName,
        training_name: displayName,
        start_date: startDateFr,
        end_date: endDateFr,
        access_link: accessLink,
      });
    } else {
      // Fallback (template missing) OR multi-training self-service
      subject = hasMultiple
        ? "Votre accès à vos formations en ligne"
        : trainingName
        ? `Votre accès à la formation ${trainingName}`
        : "Votre accès à votre formation en ligne";
      const dateLabel = startDateFr && endDateFr && startDateFr !== endDateFr
        ? ` du <strong>${startDateFr}</strong> au <strong>${endDateFr}</strong>`
        : startDateFr ? ` le <strong>${startDateFr}</strong>` : "";
      const intro = hasMultiple
        ? `Bonjour${firstName ? ` ${firstName}` : ""},\n\nVous êtes inscrit(e) aux formations suivantes :\n\n${trainingsListHtml}`
        : `Bonjour${firstName ? ` ${firstName}` : ""},\n\nVotre entreprise vient de vous inscrire à la formation e-learning ${trainingName ? `"<strong>${trainingName}</strong>"` : "votre formation"}${dateLabel}.`;
      bodyContent = `${intro}\n\nVous pouvez accéder à votre espace apprenant en cliquant sur le bouton ci-dessous :\n\n<p style="margin: 20px 0;"><a href="${accessLink}" style="display: inline-block; padding: 12px 24px; background-color: #ffd100; color: #101820; text-decoration: none; border-radius: 8px; font-weight: bold;">🎓 Accéder à mes formations</a></p>`;
    }


    const signature = await getSigniticSignature();
    const html = wrapEmailHtml(formatContentToHtml(bodyContent), signature);

    const bccList = await getBccList();
    await sendEmail({
      to: email,
      bcc: bccList,
      subject,
      html,
      _emailType: "learner_magic_link",
    });

    return new Response(
      JSON.stringify({ success: true, message: "Lien d'accès envoyé." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
