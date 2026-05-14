/**
 * supertilt-restock-email
 *
 * Generates and sends a restock email for a given game.
 * Accepts: { game_id, preview?: boolean }
 * - preview=true returns the email body without sending
 * - preview=false sends the email and logs it
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getBccList } from "../_shared/email-settings.ts";
import { processTemplate } from "../_shared/templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { game_id, preview = false } = await req.json() as { game_id: string; preview?: boolean };

    if (!game_id) {
      return new Response(JSON.stringify({ error: "game_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load game
    const { data: game, error: gameErr } = await (admin as any)
      .from("games")
      .select("*, game_authors(name, email, secondary_email)")
      .eq("id", game_id)
      .single();

    if (gameErr || !game) {
      return new Response(JSON.stringify({ error: "Jeu introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load settings
    const { data: settingsRows } = await (admin as any)
      .from("supertilt_settings")
      .select("key, value")
      .in("key", ["internal_email", "default_sender"]);
    const getSetting = (k: string) =>
      (settingsRows as Array<{ key: string; value: unknown }>)?.find((s) => s.key === k)?.value;

    const internalEmail = String(getSetting("internal_email") ?? "").replace(/^"|"$/g, "");
    const defaultSender = String(getSetting("default_sender") ?? "noreply@supertilt.fr").replace(/^"|"$/g, "");

    // Load template
    const { data: tpl } = await (admin as any)
      .from("email_templates")
      .select("subject, body")
      .eq("template_key", "restock")
      .single();

    if (!tpl) {
      return new Response(JSON.stringify({ error: "Template 'restock' introuvable" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars = {
      nom_jeu: (game as any).title ?? "",
      stock_actuel: String((game as any).current_stock ?? "?"),
      seuil_minimum: String((game as any).min_stock ?? "?"),
      elements_a_commander: (game as any).restock_items ?? "À compléter",
      fournisseurs: (game as any).restock_supplier_urls ?? "À compléter",
    };

    const subject = processTemplate((tpl as any).subject, vars, false);
    const html = processTemplate((tpl as any).body, vars, false);

    if (preview) {
      return new Response(JSON.stringify({ subject, html }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipient
    const contactEmail = (game as any).restock_contact_email
      || (game as any).game_authors?.email
      || internalEmail;

    if (!contactEmail) {
      return new Response(
        JSON.stringify({ error: "Aucun email de contact configuré pour le réapprovisionnement" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bccEmails = await getBccList();
    const result = await sendEmail({
      to: contactEmail,
      bcc: bccEmails.length ? bccEmails : undefined,
      subject,
      html,
      from: defaultSender,
      _emailType: "supertilt-restock",
    });

    // Log the send
    await (admin as any).from("order_email_log").insert({
      wc_order_id: null,
      template_key: "restock",
      sent_to: [contactEmail],
      subject,
      body: html,
      status: result.success ? "sent" : "failed",
      error: result.error ?? null,
    });

    return new Response(JSON.stringify({ ok: result.success, to: contactEmail, error: result.error }), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
