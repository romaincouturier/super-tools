/**
 * supertilt-webhook
 *
 * Receives WooCommerce order webhooks (order.created / order.updated).
 * - Validates the WC-Webhook-Signature header
 * - Filters by configured statuses (completed, processing, …)
 * - Upserts the raw order into woocommerce_orders
 * - Creates/updates order_items rows for each line item
 * - Matches products to the games catalog; unknown products → kanban "to_validate"
 * - Triggers email sending via supertilt-send-email when auto_send is ON
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { appendRowToSheet } from "../_shared/google-sheets-helper.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WCAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

interface WCLineItem {
  id: number;
  product_id: number;
  variation_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  total: string;
  subtotal: string;
}

interface WCOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  billing: WCAddress;
  shipping: WCAddress;
  total: string;
  subtotal?: string;
  total_tax: string;
  shipping_total: string;
  payment_method: string;
  payment_method_title: string;
  line_items: WCLineItem[];
  meta_data?: Array<{ key: string; value: unknown }>;
}

type VisibleOrderItemPatch = {
  game_id?: string | null;
  game_type?: string | null;
  kanban_status?: string;
  block_reason?: string | null;
  validation_status?: string;
};

async function upsertVisibleOrderItem(
  admin: any,
  wooOrderId: string,
  order: WCOrder,
  item: WCLineItem,
  patch: VisibleOrderItemPatch = {},
) {
  const payload = {
    woocommerce_order_id: wooOrderId,
    wc_order_id: order.id,
    wc_product_id: item.product_id,
    wc_variation_id: item.variation_id || null,
    product_name: item.name,
    game_id: patch.game_id ?? null,
    game_type: patch.game_type ?? null,
    quantity: item.quantity,
    unit_price: item.price,
    line_total: parseFloat(item.total ?? "0"),
    kanban_status: patch.kanban_status ?? "to_validate",
    block_reason: patch.block_reason ?? null,
    validation_status: patch.validation_status ?? "pending",
    raw_line_item: item,
  };

  const { data, error } = await (admin as any)
    .from("order_items")
    .upsert(payload, { onConflict: "woocommerce_order_id,wc_product_id", ignoreDuplicates: false })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data as { id: string } | null;
}

// Verify WooCommerce HMAC-SHA256 signature
async function verifySignature(secret: string, body: string, sig: string): Promise<boolean> {
  if (!secret) return false; // secret not configured → reject
  if (!sig) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return expected === sig;
  } catch {
    return false;
  }
}

function formatAddress(a: WCAddress): string {
  return [
    [a.first_name, a.last_name].filter(Boolean).join(" "),
    a.address_1,
    a.address_2,
    [a.postcode, a.city].filter(Boolean).join(" "),
    a.country,
  ].filter(Boolean).join(", ");
}

// ── French date parser ────────────────────────────────────────────────────────
// Extrait la première date trouvée dans un titre WooCommerce (ex: "Formation X - 15 mars 2025")
const FRENCH_MONTHS: Record<string, string> = {
  janvier: "01", "février": "02", fevrier: "02", mars: "03", avril: "04",
  mai: "05", juin: "06", juillet: "07", "août": "08", aout: "08",
  septembre: "09", octobre: "10", novembre: "11", "décembre": "12", decembre: "12",
};



function parseFrenchDates(text: string): { start: string } | null {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  // "15/03/2025" or "15-03-2025"
  const numeric = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (numeric) {
    const [, d, m, y] = numeric;
    return { start: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  // Supports: "15 mars 2025", "du 15 mars 2025", "15 au 17 mars 2025",
  //           "15 et 16 juin 2026", "15 & 16 juin 2026", "les 15-16 juin 2026",
  //           "15, 16 juin 2026", "15 ou 16 juin 2026"
  const monthPattern = Object.keys(FRENCH_MONTHS).join("|");
  const sep = `(?:\\s*(?:au|et|ou|&|,|-|–|—|/)\\s*\\d{1,2})*`;
  const french = t.match(new RegExp(`(\\d{1,2})${sep}\\s+(${monthPattern})\\s+(\\d{4})`));
  if (french) {
    const [, d, month, y] = french;
    const m = FRENCH_MONTHS[month];
    if (m) return { start: `${y}-${m}-${d.padStart(2, "0")}` };
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Capture headers (utile pour debug / replay)
  const headersObj: Record<string, string> = {};
  req.headers.forEach((v, k) => { headersObj[k] = v; });

  // Topic WooCommerce (ex: order.created, order.updated)
  const eventType = req.headers.get("x-wc-webhook-topic")
    ?? req.headers.get("x-wc-webhook-event")
    ?? null;

  let logId: string | null = null;
  const rawBody = await req.text();

  // ── LOG IMMÉDIAT du payload reçu (avant tout traitement) ────
  // On stocke le payload brut comme objet si JSON parseable, sinon comme string
  let payloadForLog: unknown = rawBody;
  try { payloadForLog = JSON.parse(rawBody); } catch { /* keep as string */ }

  try {
    const { data: logRow } = await (admin as any)
      .from("webhook_logs")
      .insert({
        source: "woocommerce",
        event_type: eventType,
        payload: payloadForLog,
        headers: headersObj,
        wc_order_id: typeof (payloadForLog as any)?.id === "number" ? (payloadForLog as any).id : null,
        status: "received",
      })
      .select("id")
      .single();
    logId = (logRow as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("webhook_logs insert error:", e);
  }

  const updateLog = async (patch: Record<string, unknown>) => {
    if (!logId) return;
    try {
      await (admin as any).from("webhook_logs").update(patch).eq("id", logId);
    } catch (e) {
      console.error("webhook_logs update error:", e);
    }
  };

  try {
    let order: WCOrder;
    try {
      order = JSON.parse(rawBody);
    } catch {
      await updateLog({ status: "error", response_status: 400, error_message: "Invalid JSON body", processed_at: new Date().toISOString() });
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load settings ────────────────────────────────────────────
    const { data: settingsRows } = await (admin as any)
      .from("supertilt_settings")
      .select("key, value");

    const getSetting = (k: string) =>
      (settingsRows as Array<{ key: string; value: unknown }>)?.find((s) => s.key === k)?.value;

    const allowedStatuses: string[] = (getSetting("wc_statuses_to_process") as string[]) ?? [
      "completed",
      "processing",
    ];
    const autoSend = getSetting("auto_send_emails") === true;
    const vatRate: number = Number(getSetting("vat_rate") ?? 0.20);
    const stripeFeeRate: number = Number(getSetting("stripe_fee_rate") ?? 0.014);
    const stripeFeeFixed: number = Number(getSetting("stripe_fee_fixed") ?? 0.25);
    const defaultCurrency: string = (getSetting("default_currency") as string) ?? "EUR";
    let webhookSecret = (getSetting("wc_webhook_secret") as string) ?? "";
    // Defensive: strip accidental surrounding quotes from double-JSON-encoded values
    if (typeof webhookSecret === "string" && webhookSecret.startsWith('"') && webhookSecret.endsWith('"')) {
      webhookSecret = webhookSecret.slice(1, -1);
    }

    // ── Verify signature ─────────────────────────────────────────
    const sig = req.headers.get("x-wc-webhook-signature") ?? "";
    const valid = await verifySignature(String(webhookSecret), rawBody, sig);
    if (!valid) {
      await updateLog({ status: "error", response_status: 401, error_message: "Invalid webhook signature", processed_at: new Date().toISOString() });
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Filter by status ─────────────────────────────────────────
    if (!allowedStatuses.includes(order.status)) {
      await updateLog({ status: "skipped", response_status: 200, wc_order_id: order.id, error_message: `Status '${order.status}' not in allowed list`, processed_at: new Date().toISOString() });
      return new Response(
        JSON.stringify({ skipped: true, reason: `Status '${order.status}' not in allowed list` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Upsert woocommerce_orders ────────────────────────────────
    const orderPayload = {
      wc_order_id: order.id,
      order_number: order.number,
      wc_status: order.status,
      date_created: order.date_created,
      customer_first_name: order.billing?.first_name ?? null,
      customer_last_name: order.billing?.last_name ?? null,
      customer_email: order.billing?.email ?? null,
      billing_address: order.billing ?? null,
      shipping_address: order.shipping ?? null,
      total_ttc: parseFloat(order.total ?? "0"),
      total_tax: parseFloat(order.total_tax ?? "0"),
      shipping_total: parseFloat(order.shipping_total ?? "0"),
      payment_method: order.payment_method ?? null,
      payment_method_title: order.payment_method_title ?? null,
      line_items: order.line_items ?? [],
      raw_order: order,
      processed_at: new Date().toISOString(),
    };

    const { data: savedOrder, error: orderErr } = await (admin as any)
      .from("woocommerce_orders")
      .upsert(orderPayload, { onConflict: "wc_order_id" })
      .select("id")
      .single();

    if (orderErr) {
      console.error("woocommerce_orders upsert error:", orderErr);
      throw new Error(orderErr.message);
    }

    const wooOrderId: string = (savedOrder as { id: string }).id;

    // ── Load games catalog ───────────────────────────────────────
    const { data: games } = await (admin as any)
      .from("games")
      .select("id, title, woocommerce_product_id, game_type, location_variation_id, author_id, commission_type, commission_rate, commission_fixed, is_partner, partner_email, include_stripe_fees, bilan_url")
      .not("woocommerce_product_id", "is", null);

    type GameRow = {
      id: string;
      title: string | null;
      woocommerce_product_id: number;
      game_type: string;
      location_variation_id: number | null;
      commission_type: string | null;
      commission_rate: number | null;
      commission_fixed: number | null;
      include_stripe_fees: boolean | null;
      bilan_url: string | null;
    };
    const gamesByProductId = new Map(
      ((games ?? []) as GameRow[])
        .map((g) => [g.woocommerce_product_id, g]),
    );

    // ── Load formation formulas (e-learning products) ────────────
    const { data: formulas } = await (admin as any)
      .from("formation_formulas")
      .select("id, name, coaching_sessions_count, formation_config_id, woocommerce_product_id, formation_configs(formation_name, format_formation)")
      .not("woocommerce_product_id", "is", null);

    type FormulaRow = {
      id: string;
      name: string;
      coaching_sessions_count: number | null;
      formation_config_id: string | null;
      woocommerce_product_id: number;
      formation_configs: { formation_name: string; format_formation: string | null } | null;
    };
    const formulasByProductId = new Map(
      ((formulas ?? []) as FormulaRow[]).map((f) => [f.woocommerce_product_id, f]),
    );

    // (Les paramètres d'application et la logique d'ajout de participant sont
    //  gérés par add-training-participant — plus besoin de les charger ici.)

    // ── Process each line item ───────────────────────────────────
    const results = { items_processed: 0, items_to_validate: 0, emails_queued: 0, formations_processed: 0 };

    for (const item of order.line_items ?? []) {
     try {
      const formula = formulasByProductId.get(item.product_id);
      const game = formula ? undefined : gamesByProductId.get(item.product_id);

      // ── Formation reconnue dans le catalogue ─────────────────
      if (formula) {
        const customerEmail = (order.billing?.email ?? "").trim().toLowerCase();

        if (!customerEmail) {
          await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
            game_type: "formation",
            kanban_status: "to_validate",
            block_reason: "[Formation] Email client manquant — routage participant impossible",
            validation_status: "pending",
          });
          results.items_to_validate++;
          continue;
        }

        const formationName = formula.formation_configs?.formation_name ?? "";
        const catalogFormat = (formula.formation_configs?.format_formation ?? "").toLowerCase();
        const isElearningCatalog = catalogFormat.includes("e_learning") || catalogFormat.includes("elearning") || catalogFormat.includes("classe_virtuelle");
        const catalogId = formula.formation_config_id;

        let training: { id: string; training_name: string; start_date: string | null; end_date: string | null; format_formation: string | null } | null = null;
        let routingReason = "";
        const parsedDates = parseFrenchDates(item.name ?? "");

        // Routing strict via training_formulas (sessions explicitement liées à la formule achetée).
        // Fallback historique sur catalog_id si aucune liaison n'a encore été déclarée.
        if (catalogId) {
          const today = new Date().toISOString().split("T")[0];

          // Sessions explicitement liées à cette formule
          const { data: linkedRows } = await (admin as any)
            .from("training_formulas")
            .select("training_id, trainings:training_id(id, training_name, start_date, end_date, format_formation, is_cancelled, catalog_id)")
            .eq("formula_id", formula.id);

          type LinkedTraining = {
            id: string;
            training_name: string;
            start_date: string | null;
            end_date: string | null;
            format_formation: string | null;
            is_cancelled: boolean | null;
            catalog_id: string | null;
          };
          const linkedTrainings: LinkedTraining[] = ((linkedRows ?? []) as Array<{ trainings: LinkedTraining | null }>)
            .map((r) => r.trainings)
            .filter((t): t is LinkedTraining => !!t && t.is_cancelled !== true);

          // 1️⃣ Dates parsées dans le titre Woo → session datée correspondante liée à la formule
          if (parsedDates) {
            const byDate = linkedTrainings.find((t) => t.start_date === parsedDates.start);
            if (byDate) {
              training = byDate;
              routingReason = `formule ${formula.name} — session du ${parsedDates.start} liée explicitement`;
            }
          }

          // 2️⃣ Sinon session permanente liée à la formule (start_date NULL)
          if (!training) {
            const permanent = linkedTrainings.find((t) => t.start_date === null);
            if (permanent) {
              training = permanent;
              routingReason = `formule ${formula.name} — session permanente liée`;
            }
          }

          // 3️⃣ Sinon prochaine session datée liée à la formule
          if (!training) {
            const upcoming = linkedTrainings
              .filter((t) => t.start_date !== null && t.start_date! > today)
              .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
            if (upcoming) {
              training = upcoming;
              routingReason = `formule ${formula.name} — prochaine session datée liée (${upcoming.start_date})`;
            }
          }

          // 4️⃣ Fallback historique (aucune liaison déclarée pour cette formule) : on garde
          //     l'ancienne logique catalog_id pour ne pas régresser tant que l'admin n'a pas migré.
          if (!training && linkedTrainings.length === 0) {
            if (parsedDates) {
              const { data: byDate } = await (admin as any)
                .from("trainings")
                .select("id, training_name, start_date, end_date, format_formation")
                .eq("catalog_id", catalogId)
                .eq("is_cancelled", false)
                .eq("start_date", parsedDates.start)
                .maybeSingle();
              if (byDate) {
                training = byDate;
                routingReason = `fallback catalog_id — session du ${parsedDates.start}`;
              }
            }

            if (!training && isElearningCatalog) {
              const { data: permanent } = await (admin as any)
                .from("trainings")
                .select("id, training_name, start_date, end_date, format_formation")
                .eq("catalog_id", catalogId)
                .eq("is_cancelled", false)
                .is("start_date", null)
                .limit(1)
                .maybeSingle();
              if (permanent) {
                training = permanent;
                routingReason = `fallback catalog_id — session permanente`;
              }
            }

            if (!training) {
              const { data: upcoming } = await (admin as any)
                .from("trainings")
                .select("id, training_name, start_date, end_date, format_formation")
                .eq("catalog_id", catalogId)
                .eq("is_cancelled", false)
                .eq("format_formation", "inter-entreprises")
                .gt("start_date", today)
                .order("start_date", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (upcoming) {
                training = upcoming;
                routingReason = `fallback catalog_id — prochaine session inter-entreprises`;
              }
            }
          }
        }




        // 3️⃣ Inbox si aucune session trouvée
        if (!training) {
          const reason = parsedDates
            ? `Dates trouvées (${parsedDates.start}) mais aucune session inter correspondante`
            : isElearningCatalog
            ? "Formation e-learning sans session programmée à venir"
            : "Formation reconnue mais aucune session inter ou e-learning trouvée";

          await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
            game_type: "formation",
            kanban_status: "to_validate",
            block_reason: `[Formation] ${formationName} — ${reason}`,
            validation_status: "pending",
          });

          results.items_to_validate++;
          continue;
        }

        // 4️⃣ Ajoute le participant via la logique métier centralisée
        const billingCompany = (order.billing?.company ?? "").trim();
        const billingAddr = order.billing as {
          address_1?: string; address_2?: string;
          city?: string; postcode?: string; country?: string;
        } | undefined;
        const coachingTotal = formula.coaching_sessions_count ?? 0;
        const coachingDeadline = coachingTotal > 0
          ? (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })()
          : null;

        const { data: addResult, error: addError } = await (admin as any).functions.invoke(
          "add-training-participant",
          {
            body: {
              trainingId: training.id,
              trainingStartDate: training.start_date,
              trainingEndDate: training.end_date,
              formatFormation: training.format_formation,
              isInterEntreprise: true,
              email: customerEmail,
              firstName: order.billing?.first_name ?? null,
              lastName: order.billing?.last_name ?? null,
              company: billingCompany || null,
              companyAddress: [billingAddr?.address_1, billingAddr?.address_2].filter(Boolean).join(", ") || null,
              companyCity: billingAddr?.city ?? null,
              companyZip: billingAddr?.postcode ?? null,
              typeStagiaireBpf: billingCompany ? "Entreprise" : "Particulier",
              sponsorEmail: customerEmail,
              sponsorFirstName: order.billing?.first_name ?? null,
              sponsorLastName: order.billing?.last_name ?? null,
              soldPriceHt: parseFloat(item.total ?? "0") || null,
              paymentMode: "online",
              formulaId: formula.id || null,
              formulaName: formula.name || null,
              coachingSessionsTotal: coachingTotal,
              coachingDeadline,
              source: "woocommerce",
              notes: `Vente WooCommerce #${order.id} — ${item.name}`,
              woocommerceOrderId: order.id,
              woocommerceProductId: item.product_id,
              routingReason,
            },
          },
        );

        if (addError) {
          console.error("add-training-participant failed:", addError);
          throw new Error(`add-training-participant: ${addError.message ?? String(addError)}`);
        }

        console.log(`Formation routed: ${formationName} → training ${training.id} (${routingReason})`, addResult);
        await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
          game_type: "formation",
          kanban_status: "received",
          block_reason: `[Formation] Routée vers ${training.training_name} — ${routingReason}`,
          validation_status: "validated",
        });
        results.formations_processed++;
        // Les formations ne passent pas par le kanban jeux
        continue;
      }

      let kanbanStatus: string;
      let gameId: string | null = null;
      let gameType: string | null = null;
      let blockReason: string | null = null;

      if (!game) {
        kanbanStatus = "to_validate";
        blockReason = `Produit WooCommerce #${item.product_id} non reconnu (ni jeu, ni formation e-learning)`;
        results.items_to_validate++;
      } else {
        gameId = game.id;
        // If the game has a dedicated location variation, check whether this
        // specific line item is the rental variant or the purchase variant.
        // variation_id === 0 means WooCommerce sent no variation (simple product).
        const isLocationVariant =
          game.location_variation_id != null &&
          item.variation_id != null &&
          item.variation_id !== 0 &&
          item.variation_id === game.location_variation_id;
        const effectiveGameType = isLocationVariant ? "location" : game.game_type;
        gameType = effectiveGameType;
        kanbanStatus = effectiveGameType === "supertilt"
          ? "to_ship"
          : effectiveGameType === "dropshipping"
          ? "dropshipping"
          : effectiveGameType === "location"
          ? "location_pending"
          : "received"; // partner or other
        results.items_processed++;
      }

      const savedItem = await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
        game_id: gameId,
        game_type: gameType,
        kanban_status: kanbanStatus,
        block_reason: blockReason,
        validation_status: game ? "validated" : "pending",
      });

      // ── Historize sale into game_sales (with Stripe fee calc) ──
      if (game && gameId) {
        const lineHT = parseFloat(item.total ?? "0");
        const qty = item.quantity ?? 1;
        const unit = qty > 0 ? lineHT / qty : lineHT;
        const lineTTC = +(lineHT * (1 + vatRate)).toFixed(2);
        const vatAmount = +(lineTTC - lineHT).toFixed(2);
        const includeFees = (game as any).include_stripe_fees === true;
        const bankFees = includeFees
          ? +(lineTTC * stripeFeeRate + stripeFeeFixed).toFixed(2)
          : 0;
        const netAmount = +(lineTTC - bankFees).toFixed(2);

        // Royalty (HT-based)
        let royalty = 0;
        if (game.commission_type === "percentage" && game.commission_rate) {
          royalty = +(lineHT * Number(game.commission_rate)).toFixed(2);
        } else if (game.commission_type === "fixed" && game.commission_fixed) {
          royalty = +(Number(game.commission_fixed) * qty).toFixed(2);
        }

        const saleKey = `${order.id}-${item.product_id}`;
        await (admin as any)
          .from("game_sales")
          .upsert(
            {
              game_id: gameId,
              woocommerce_order_id: saleKey,
              customer_name: [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(" ") || null,
              customer_email: order.billing?.email ?? null,
              quantity: qty,
              unit_price: unit,
              total_amount: lineTTC,
              amount_ht: lineHT,
              vat_amount: vatAmount,
              bank_fees: bankFees,
              net_amount: netAmount,
              currency: defaultCurrency,
              royalty_amount: royalty,
              sale_date: order.date_created,
              status: "paid",
              raw_order: order,
            },
            { onConflict: "woocommerce_order_id" },
          );
      }

      // Trigger email if auto-send is on and we have a game
      if (autoSend && game && savedItem) {
        try {
          const emailFnUrl = `${SUPABASE_URL}/functions/v1/supertilt-send-email`;
          await fetch(emailFnUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ order_item_id: (savedItem as { id: string }).id }),
          });
          results.emails_queued++;
        } catch (e) {
          console.error("Failed to queue email for item:", e);
        }
      }
     } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        console.error(`Line item processing failed (product ${item.product_id}):`, msg);
        // Safety net: ensure the orphan line item is visible in the inbox
        await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
          kanban_status: "to_validate",
          block_reason: `Erreur de traitement automatique : ${msg}`,
          validation_status: "pending",
        });
        results.items_to_validate++;
      }
    }

    // ── Safety net: if the order produced no order_items at all,
    //    insert orphan rows so it surfaces in the WooCommerce inbox.
    //    Intentionally counts ALL rows including archived ones (archived_at
    //    set): an archived line must not be re-inserted as a visible duplicate.
    const { count: itemsCount } = await (admin as any)
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("woocommerce_order_id", wooOrderId);

    if ((itemsCount ?? 0) === 0 && (order.line_items?.length ?? 0) > 0) {
      console.warn(`[supertilt-webhook] Order #${order.id} produced 0 order_items — inserting orphans`);
      for (const item of order.line_items ?? []) {
        await upsertVisibleOrderItem(admin, wooOrderId, order, item, {
          kanban_status: "to_validate",
          block_reason: `Commande non routée automatiquement — aucune ligne n'a pu être traitée (produit #${item.product_id})`,
          validation_status: "pending",
        });
      }
    }

    await updateLog({ status: "processed", response_status: 200, wc_order_id: order.id, processed_at: new Date().toISOString() });
    return new Response(JSON.stringify({ ok: true, wc_order_id: order.id, log_id: logId, ...results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("supertilt-webhook error:", message);
    await reportEdgeError(err, { fn: "supertilt-webhook" });
    await updateLog({ status: "error", response_status: 500, error_message: message, processed_at: new Date().toISOString() });
    return new Response(JSON.stringify({ error: message, log_id: logId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
