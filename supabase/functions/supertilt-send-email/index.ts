/**
 * supertilt-send-email
 *
 * Sends the appropriate email for a given order_item_id.
 * - Looks up the item, its game, and the parent WooCommerce order
 * - Resolves the correct email template (dropshipping / location / partner / internal_notif)
 * - Substitutes template variables
 * - Sends via Resend
 * - Logs to order_email_log
 * - Updates order_items.email_sent_at and kanban_status if applicable
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import { processTemplate } from "../_shared/templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function formatAddress(addr: Record<string, string> | null): string {
  if (!addr) return "";
  return [
    [addr.first_name, addr.last_name].filter(Boolean).join(" "),
    addr.address_1,
    addr.address_2,
    [addr.postcode, addr.city].filter(Boolean).join(" "),
    addr.country,
  ].filter(Boolean).join(", ");
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { order_item_id } = await req.json() as { order_item_id: string };
    if (!order_item_id) {
      return new Response(JSON.stringify({ error: "order_item_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load order item with joins ───────────────────────────────
    const { data: item, error: itemErr } = await (admin as any)
      .from("order_items")
      .select(`
        *,
        woocommerce_orders!woocommerce_order_id (
          wc_order_id, order_number, date_created,
          customer_first_name, customer_last_name, customer_email,
          shipping_address, billing_address, total_ttc, total_ht, total_tax
        ),
        games!game_id (
          id, title, game_type, woocommerce_product_url,
          custom_message, is_partner, partner_name, partner_email,
          commission_type, commission_rate, commission_fixed,
          secondary_author_email,
          game_authors!author_id (name, email, secondary_email, phone, royalty_rate)
        )
      `)
      .eq("id", order_item_id)
      .single();

    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: "Order item not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const order = (item as any).woocommerce_orders;
    const game = (item as any).games;
    const author = game?.game_authors;

    if (!game) {
      return new Response(
        JSON.stringify({ error: "No game linked to this item — validate first" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Compute commission ───────────────────────────────────────
    const lineTotal: number = (item as any).line_total ?? 0;
    let commission = "–";
    if (game.commission_type === "percentage" && game.commission_rate) {
      commission = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
        lineTotal * game.commission_rate,
      );
    } else if (game.commission_type === "fixed" && game.commission_fixed) {
      commission = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
        game.commission_fixed,
      );
    }

    // ── Build template variables ─────────────────────────────────
    const fmtEUR = (n: number) =>
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
    const lineTotalNum: number = Number((item as any).line_total ?? 0);
    const qty: number = Number((item as any).quantity ?? 1);
    const unitPrice: number = Number((item as any).unit_price ?? (qty ? lineTotalNum / qty : 0));
    // WooCommerce line_total is stored HT in this project
    const lineHT = lineTotalNum;
    const lineTTC = lineTotalNum * 1.2;
    const authorName: string = author?.name ?? "";
    const prenomAuteur = authorName.split(/\s+/)[0] ?? "";
    const royalty: number = Number(author?.royalty_rate ?? 0);
    const tauxCommission = royalty > 0
      ? `${Math.round(royalty * 100)}%`
      : "";
    const billing = order?.billing_address ?? {};
    const shipping = order?.shipping_address ?? {};
    const telephone = (shipping as any)?.phone || (billing as any)?.phone || "";
    const customerNote: string =
      (item as any).notes ??
      (order as any)?.raw_order?.customer_note ??
      "";

    const vars: Record<string, string> = {
      nom_jeu: game.title ?? "",
      quantite: String(qty),
      nom_client: [order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") || "Client",
      prenom_client: order?.customer_first_name ?? "",
      nom_famille_client: order?.customer_last_name ?? "",
      email_client: order?.customer_email ?? "",
      telephone,
      adresse_livraison: formatAddress(order?.shipping_address ?? order?.billing_address),
      numero_commande: order?.order_number ?? String(order?.wc_order_id ?? ""),
      url_produit: game.woocommerce_product_url ?? "",
      message_personnalise_jeu: game.custom_message ?? "",
      note_client: customerNote ?? "",
      prenom_auteur: prenomAuteur,
      nom_auteur: authorName,
      taux_commission: tauxCommission,
      prix_vendu: fmtEUR(lineTTC),
      prix_ht: fmtEUR(lineHT),
      prix_unitaire_ht: fmtEUR(unitPrice),
      montant_ttc: fmtEUR(lineTTC),
      montant_ht: fmtEUR(lineHT),
      commission,
      date_commande: order?.date_created
        ? new Date(order.date_created).toLocaleDateString("fr-FR")
        : "",
    };

    // ── Load settings ────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("supertilt_settings")
      .select("key, value");

    const getSetting = (k: string) =>
      (settingsRows as Array<{ key: string; value: unknown }>)?.find((s) => s.key === k)?.value;

    const internalEmail = String(getSetting("internal_email") ?? "").replace(/^"|"$/g, "");
    const defaultSender = String(getSetting("default_sender") ?? "noreply@supertilt.fr").replace(/^"|"$/g, "");
    const appBaseUrl = String(getSetting("app_base_url") ?? "https://super-tools.lovable.app").replace(/^"|"$/g, "").replace(/\/$/, "");

    // ── Resolve / create partner tracking link if applicable ────
    let lienSuiviPartenaire = "";
    if (game.is_partner && game.id) {
      const { data: existingTok } = await (admin as any)
        .from("partner_access_tokens")
        .select("token")
        .eq("game_id", game.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let tok = (existingTok as any)?.token as string | undefined;
      if (!tok) {
        const { data: created } = await (admin as any)
          .from("partner_access_tokens")
          .insert({ game_id: game.id, label: "auto-generated" })
          .select("token")
          .single();
        tok = (created as any)?.token;
      }
      if (tok) lienSuiviPartenaire = `${appBaseUrl}/partenaire/${tok}`;
    }
    vars.lien_suivi_partenaire = lienSuiviPartenaire;
    vars.contrat_url = (game as any).location_contract_url ?? "";
    vars.partenaire_nom = game.partner_name ?? "";

    // ── Determine template key and recipients ────────────────────
    let templateKey = "internal_notif";
    let toEmails: string[] = [];
    let ccEmails: string[] = [];

    const gameType: string = game.game_type ?? "dropshipping";

    if (gameType === "dropshipping") {
      templateKey = "dropshipping";
      if (author?.email) toEmails.push(author.email);
      if (game.secondary_author_email) ccEmails.push(game.secondary_author_email);
      if (author?.secondary_email) ccEmails.push(author.secondary_email);
    } else if (gameType === "location") {
      templateKey = "location";
      if (order?.customer_email) toEmails.push(order.customer_email);
    } else if (gameType === "partner") {
      templateKey = "partner";
      if (game.partner_email) toEmails.push(game.partner_email);
    } else if (gameType === "supertilt") {
      templateKey = "internal_notif";
      if (internalEmail) toEmails.push(internalEmail);
    }

    // Fallback to internal
    if (!toEmails.length) {
      if (internalEmail) toEmails.push(internalEmail);
      else {
        await (admin as any).from("order_email_log").insert({
          order_item_id,
          wc_order_id: order?.wc_order_id,
          template_key: templateKey,
          sent_to: [],
          status: "failed",
          error: "No recipient configured — check game/author/settings",
        });
        await (admin as any).from("order_items")
          .update({ kanban_status: "blocked", block_reason: "Aucun destinataire email configuré" })
          .eq("id", order_item_id);

        return new Response(
          JSON.stringify({ error: "No recipient configured" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Load and process template ────────────────────────────────
    const { data: tpl } = await (admin as any)
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", `supertilt_${templateKey}`)
      .maybeSingle();

    if (!tpl) {
      await (admin as any).from("order_items")
        .update({ kanban_status: "blocked", block_reason: `Template email 'supertilt_${templateKey}' introuvable` })
        .eq("id", order_item_id);

      return new Response(
        JSON.stringify({ error: `Email template 'supertilt_${templateKey}' not found` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = processTemplate((tpl as any).subject, vars, false);
    let html = processTemplate((tpl as any).html_content, vars, false);

    // ── Friendly reminder for pending invoices ───────────────────
    // Only for dropshipping (the author invoices SuperTilt)
    if (gameType === "dropshipping" && game?.author_id) {
      const { data: pendingRows } = await (admin as any)
        .from("order_items")
        .select("id, games!game_id(author_id)")
        .not("email_sent_at", "is", null)
        .is("invoice_received_at", null)
        .neq("id", order_item_id);

      const pendingForAuthor = (pendingRows ?? []).filter(
        (r: any) => r?.games?.author_id === game.author_id,
      ).length;
      // +1 = the current order being sent
      const totalPending = pendingForAuthor + 1;

      if (totalPending >= 5) {
        const reminderHtml = `
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
<p>👉 Petite chose au passage : il y a maintenant <strong>${totalPending} jeux</strong> en attente de facture de ta part. Quand tu auras un moment, ce serait top de me les envoyer pour éviter les trous de trésorerie de mon côté 😉</p>
<p>Pas d'urgence absolue, mais plus c'est régulier, plus c'est simple pour tout le monde. Merci d'avance !</p>`;
        html = html + reminderHtml;
      }
    }

    // ── Send email ───────────────────────────────────────────────
    const result = await sendEmail({
      to: toEmails,
      cc: ccEmails.length ? ccEmails : undefined,
      subject,
      html,
      from: defaultSender,
      _emailType: `supertilt-${templateKey}`,
    });

    // ── Log result ───────────────────────────────────────────────
    await (admin as any).from("order_email_log").insert({
      order_item_id,
      wc_order_id: order?.wc_order_id,
      template_key: templateKey,
      sent_to: toEmails,
      cc: ccEmails,
      subject,
      body: html,
      status: result.success ? "sent" : "failed",
      error: result.error ?? null,
    });

    if (result.success) {
      // Update item status
      const nextStatus = gameType === "dropshipping" || gameType === "supertilt" || gameType === "partner"
        ? "processed"
        : undefined; // location stays in location_pending until contract returned

      await (admin as any).from("order_items")
        .update({
          email_sent_at: new Date().toISOString(),
          email_sent_to: toEmails.join(", "),
          ...(nextStatus ? { kanban_status: nextStatus } : {}),
        })
        .eq("id", order_item_id);
    } else {
      await (admin as any).from("order_items")
        .update({ kanban_status: "blocked", block_reason: `Erreur envoi email: ${result.error}` })
        .eq("id", order_item_id);
    }

    // ── Notify partner (if game is co-created) ───────────────────
    // Sent in addition to the main email, when is_partner=true and we
    // didn't already use the 'partner' template as the main one.
    let partnerNotified = false;
    if (
      result.success &&
      game.is_partner &&
      game.partner_email &&
      templateKey !== "partner"
    ) {
      try {
        const { data: ptpl } = await (admin as any)
          .from("email_templates")
          .select("subject, html_content")
          .eq("template_type", "supertilt_partner")
          .maybeSingle();
        if (ptpl) {
          const psubject = processTemplate((ptpl as any).subject, vars, false);
          const phtml = processTemplate((ptpl as any).html_content, vars, false);
          const presult = await sendEmail({
            to: [game.partner_email],
            subject: psubject,
            html: phtml,
            from: defaultSender,
            _emailType: "supertilt-partner",
          });
          await (admin as any).from("order_email_log").insert({
            order_item_id,
            wc_order_id: order?.wc_order_id,
            template_key: "partner",
            sent_to: [game.partner_email],
            cc: [],
            subject: psubject,
            body: phtml,
            status: presult.success ? "sent" : "failed",
            error: presult.error ?? null,
          });
          partnerNotified = presult.success;
        }
      } catch (e) {
        console.error("partner notify error:", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: result.success, to: toEmails, template: templateKey, partner_notified: partnerNotified, error: result.error }),
      { status: result.success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("supertilt-send-email error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
