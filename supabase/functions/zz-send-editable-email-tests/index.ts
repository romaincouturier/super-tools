// TEMPORARY: sends one test email per editable email default. Deleted after use.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSenderEmail } from "../_shared/email-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { wrapEmailHtml } from "../_shared/templates.ts";
import { renderCatalogEmail, ctaButton } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";

serve(async (req) => {
  const { only, offset = 0, limit = 100 } = await req.json().catch(() => ({}));
  const supabase = getSupabaseClient();
  const to = await getSenderEmail();
  const signature = await getSigniticSignature();
  const keys = Object.keys(EDITABLE_EMAIL_DEFAULTS).filter((k) => !only || only.includes(k));
  const total = keys.length;
  const results: Array<{ key: string; ok: boolean; error?: string }> = [];
  for (const [i, key] of keys.entries()) {
    if (i < offset || i >= offset + limit) continue;
    const d = EDITABLE_EMAIL_DEFAULTS[key];
    const vars: Record<string, string> = {};
    const blocks: Record<string, string> = {};
    for (const v of d.variables) {
      vars[v] = `[${v}]`;
      blocks[v] = /button|link/.test(v)
        ? ctaButton(`[bouton ${v}]`, "https://super-tools.lovable.app")
        : `<span style="background:#fff3cd;padding:0 4px;">[${v}]</span>`;
    }
    try {
      const r = await renderCatalogEmail(supabase, key, { vars, blocks });
      const res = await sendEmail({
        to: [to],
        subject: `[TEST ${i + 1}/${total}] ${r.subject}`,
        html: wrapEmailHtml(
          `<p style="color:#888;font-size:12px;">Test : ${d.name} (${key})${r.fromTemplate ? " — modèle personnalisé" : " — texte par défaut"}</p>${r.html}`,
          d.audience === "client" ? signature : "",
        ),
        _emailType: "editable_email_test",
      });
      results.push({ key, ok: !!res.success, error: res.success ? undefined : String(res.error) });
    } catch (e) {
      results.push({ key, ok: false, error: String(e) });
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return new Response(JSON.stringify({ to, total, results }), { headers: { "Content-Type": "application/json" } });
});
