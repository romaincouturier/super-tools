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
import { linkExpiresAt, linkValidityLabel } from "../_shared/learner-links.ts";

/** Empreinte de l'adresse : le journal ne stocke jamais l'adresse en clair. */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    const { email, trainingId, purpose } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();

    // RG-08 : quota d'envoi tenu côté serveur. Au-delà, la réponse est la même,
    // mais aucun email ne part.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip") || "unknown";
    const emailHash = await sha256Hex(email.trim().toLowerCase());
    const { data: allowed } = await supabase.rpc("check_link_quota", {
      p_email_hash: emailHash,
      p_ip: ip,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ success: true, message: "Si un compte existe, un lien vous a été envoyé." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check participant exists (silent fail for security)
    const { data: participants } = await supabase
      .from("training_participants")
      .select("id, first_name, training_id")
      .ilike("email", email);

    // Un inscrit Academy n'a pas de ligne de participant : il est rattaché aux
    // inscriptions LMS. Sans ce second référentiel, il n'avait aucun chemin de
    // connexion (rupture D5 de la spécification).
    let hasEnrollment = false;
    if (!participants || participants.length === 0) {
      const { data: enrollments } = await supabase
        .from("lms_enrollments")
        .select("id")
        .ilike("learner_email", email)
        .limit(1);
      hasEnrollment = !!enrollments && enrollments.length > 0;
    }

    if ((!participants || participants.length === 0) && !hasEnrollment) {
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
        new Set((participants ?? []).map((p: any) => p.training_id).filter(Boolean))
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

    // Durées du chapitre 6, tenues par _shared/learner-links.ts (RG-06).
    const expiresAt = linkExpiresAt(purpose);

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
    const accessLink = `${urls.app_url}/connexion/lien?token=${link.token}`;
    const firstName = participants?.[0]?.first_name || "";

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

    if (purpose === "login") {
      // Le modèle d'activation annonce 7 jours : il ne convient pas à un lien
      // de connexion de 30 minutes (RG-15). On rend le texte dédié.
      template = null;
    }

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
      // Texte de référence : chapitre 11 de docs/SPEC_CONNEXION_APPRENANT.md.
      const validity = linkValidityLabel(purpose);
      const cta = purpose === "login" ? "Me connecter" : "Activer mon accès";
      bodyContent = [
        intro,
        `Votre espace apprenant est prêt, à l'adresse ${email}.`,
        `<p style="margin: 20px 0;"><a href="${accessLink}" style="display: inline-block; padding: 12px 24px; background-color: #ffd100; color: #101820; text-decoration: none; border-radius: 8px; font-weight: bold;">${cta}</a></p>`,
        `${validity} Passé ce délai, rendez-vous sur la page de connexion : nous vous en enverrons un nouveau en quelques secondes.`,
        "À l'ouverture du lien, vous créez votre mot de passe : c'est une étape obligatoire, elle protège votre espace. Ensuite, vous vous connectez avec votre adresse email et ce mot de passe.",
        "Vos données sont traitées par SuperTilt pour vous donner accès à votre formation. Pour demander la suppression de votre compte, écrivez à contact@supertilt.fr.",
      ].join("\n\n");
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
