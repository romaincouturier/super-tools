import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/bcc-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";

const APP_URL = "https://super-tools.lovable.app";

function quarterKey(d: Date) {
  const m = d.getUTCMonth();
  const q = Math.floor(m / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

function shouldRun(frequency: string, lastSent: string | null): boolean {
  if (!lastSent) return true;
  const last = new Date(lastSent);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  switch (frequency) {
    case "monthly": return diffDays >= 28;
    case "quarterly": return diffDays >= 88;
    case "biannual": return diffDays >= 175;
    default: return diffDays >= 88;
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    // Settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "template_review_reminder_enabled",
        "template_review_reminder_frequency",
        "template_review_reminder_last_sent",
        "communication_manager_user_id",
      ]);

    const map = Object.fromEntries((settings || []).map((s: any) => [s.setting_key, s.setting_value]));
    const enabled = map.template_review_reminder_enabled !== "false"; // default on
    const frequency = map.template_review_reminder_frequency || "quarterly";
    const lastSent = map.template_review_reminder_last_sent || null;

    if (!force) {
      if (!enabled) return createJsonResponse({ skipped: true, reason: "disabled" });
      if (!shouldRun(frequency, lastSent)) {
        return createJsonResponse({ skipped: true, reason: "too_soon", lastSent, frequency });
      }
    }

    // Recipients: admins + communication manager
    const { data: admins } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("is_admin", true);

    const recipientSet = new Map<string, string>();
    (admins || []).forEach((a: any) => {
      if (a.email) recipientSet.set(a.email.toLowerCase(), a.first_name || "");
    });

    if (map.communication_manager_user_id) {
      const { data: cm } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", map.communication_manager_user_id)
        .maybeSingle();
      if (cm?.email) recipientSet.set(cm.email.toLowerCase(), cm.first_name || "");
    }

    const recipients = Array.from(recipientSet.keys());
    if (recipients.length === 0) {
      return createJsonResponse({ skipped: true, reason: "no_recipients" });
    }

    // Counts of templates
    const [{ count: trainingTplCount }, { count: crmTplCount }, { count: snippetCount }] = await Promise.all([
      supabase.from("email_templates").select("id", { count: "exact", head: true }),
      supabase.from("crm_email_templates").select("id", { count: "exact", head: true }),
      supabase.from("email_snippets").select("id", { count: "exact", head: true }).then((r) => r).catch(() => ({ count: 0 })),
    ]);

    const bccList = await getBccList();
    let signature = "";
    try { signature = await getSigniticSignature(); } catch (_) { /* ignore */ }

    const periodLabel = frequency === "monthly" ? "mensuelle"
      : frequency === "biannual" ? "semestrielle" : "trimestrielle";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; text-align: left;">
        <h2 style="color: #1f2937;">📨 Revue ${periodLabel} des templates de communication</h2>
        <p>Bonjour,</p>
        <p>C'est l'heure de la revue ${periodLabel} de tes templates de communication.
        Prends quelques minutes pour t'assurer qu'ils sont toujours à jour, pertinents et alignés avec ton ton actuel.</p>

        <h3 style="margin-top: 24px; color: #374151;">À vérifier</h3>
        <ul style="line-height: 1.8;">
          <li><strong>Templates de formation</strong> (avant, pendant, après formation) — ${trainingTplCount ?? 0} personnalisé(s)
            <br/><a href="${APP_URL}/parametres?tab=emails" style="color: #2563eb;">Ouvrir Paramètres &rsaquo; Modèles d'emails</a>
          </li>
          <li style="margin-top: 8px;"><strong>Templates emails CRM</strong> (relances opportunités) — ${crmTplCount ?? 0} modèle(s)
            <br/><a href="${APP_URL}/parametres?tab=emails" style="color: #2563eb;">Ouvrir la gestion des modèles CRM</a>
          </li>
          <li style="margin-top: 8px;"><strong>Snippets / blocs réutilisables</strong> — ${snippetCount ?? 0} snippet(s)</li>
        </ul>

        <h3 style="margin-top: 24px; color: #374151;">Quelques pistes</h3>
        <ul style="line-height: 1.6;">
          <li>Les liens, dates, noms d'interlocuteurs sont-ils encore valides ?</li>
          <li>Le ton et le vocabulaire correspondent-ils à la ligne éditoriale actuelle ?</li>
          <li>Y a-t-il des templates obsolètes à supprimer ?</li>
          <li>De nouveaux scénarios à ajouter depuis la dernière revue ?</li>
        </ul>

        <p style="margin-top: 24px;">
          <a href="${APP_URL}/parametres?tab=emails"
             style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            Réviser les templates
          </a>
        </p>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          Cet email est envoyé automatiquement (${periodLabel}). Tu peux modifier la fréquence ou désactiver ce rappel
          dans <a href="${APP_URL}/parametres?tab=emails">Paramètres &rsaquo; Modèles d'emails</a>.
        </p>
        ${signature}
      </div>
    `;

    const result = await sendEmail({
      to: recipients,
      subject: `📨 Revue ${periodLabel} de tes templates de communication`,
      html,
      bcc: bccList,
      _emailType: "template_review_reminder",
    });

    if (result.success) {
      await supabase.from("app_settings").upsert({
        setting_key: "template_review_reminder_last_sent",
        setting_value: new Date().toISOString(),
        description: "Dernière exécution du rappel de revue des templates",
      }, { onConflict: "setting_key" });
    }

    return createJsonResponse({
      success: result.success,
      recipientCount: recipients.length,
      recipients,
      frequency,
    });
  } catch (error: unknown) {
    console.error("Error in send-template-review-reminder:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Internal error");
  }
});
