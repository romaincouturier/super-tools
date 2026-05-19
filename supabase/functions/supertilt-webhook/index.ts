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

// Verify WooCommerce HMAC-SHA256 signature
async function verifySignature(secret: string, body: string, sig: string): Promise<boolean> {
  if (!secret || !sig) return true; // no secret configured → skip verification
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

function subtractWorkingDays(
  fromDate: Date,
  daysToSubtract: number,
  workingDays: boolean[] = [false, true, true, true, true, true, false],
): Date {
  const result = new Date(fromDate);
  let remaining = daysToSubtract;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (workingDays[result.getDay()]) remaining--;
  }
  return result;
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
      .select("id, woocommerce_product_id, game_type, author_id, commission_type, commission_rate, commission_fixed, is_partner, partner_email, include_stripe_fees")
      .not("woocommerce_product_id", "is", null);

    type GameRow = {
      id: string;
      woocommerce_product_id: number;
      game_type: string;
      commission_type: string | null;
      commission_rate: number | null;
      commission_fixed: number | null;
      include_stripe_fees: boolean | null;
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

    // ── Load app_settings (e-learning access mode + email scheduling params) ────
    const { data: appSettingsRows } = await (admin as any)
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["elearning_access_mode", "working_days", "delay_needs_survey_days", "delay_trainer_summary_days"]);
    const getAppSetting = (k: string) =>
      (appSettingsRows as Array<{ setting_key: string; setting_value: string }>)
        ?.find((s) => s.setting_key === k)?.setting_value ?? "";
    const elearningAccessMode = getAppSetting("elearning_access_mode") || "magic_link";
    const workingDaysArr: boolean[] = (() => {
      try {
        const p = JSON.parse(getAppSetting("working_days"));
        return Array.isArray(p) && p.length === 7 ? p : [false, true, true, true, true, true, false];
      } catch { return [false, true, true, true, true, true, false]; }
    })();
    const needsSurveyDelay = parseInt(getAppSetting("delay_needs_survey_days") || "7", 10) || 7;
    const trainerSummaryDelay = parseInt(getAppSetting("delay_trainer_summary_days") || "1", 10) || 1;

    // ── Process each line item ───────────────────────────────────
    const results = { items_processed: 0, items_to_validate: 0, emails_queued: 0, formations_processed: 0 };

    for (const item of order.line_items ?? []) {
     try {
      const formula = formulasByProductId.get(item.product_id);
      const game = formula ? undefined : gamesByProductId.get(item.product_id);

      // ── Formation reconnue dans le catalogue ─────────────────
      if (formula) {
        const customerEmail = (order.billing?.email ?? "").trim().toLowerCase();
        if (!customerEmail) { results.items_to_validate++; continue; }

        const formationName = formula.formation_configs?.formation_name ?? "";
        const catalogFormat = (formula.formation_configs?.format_formation ?? "").toLowerCase();
        const isElearningCatalog = catalogFormat.includes("e_learning") || catalogFormat.includes("elearning") || catalogFormat.includes("classe_virtuelle");
        const catalogId = formula.formation_config_id;

        let training: { id: string; training_name: string; start_date: string | null; end_date: string | null; format_formation: string | null } | null = null;
        let routingReason = "";
        const parsedDates = parseFrenchDates(item.name ?? "");

        // Routing strict via catalog_id (lié au product_id de la formule).
        // Toutes les sessions du catalogue sont éligibles, aucun matching par nom.
        if (catalogId) {
          const today = new Date().toISOString().split("T")[0];

          // 1️⃣ Pour une formation inter : cherche une session aux dates parsées dans le titre du produit
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
              routingReason = `session du ${parsedDates.start} trouvée via dates dans le titre (catalog_id ${catalogId})`;
            }
          }

          // 2️⃣ E-learning : session permanente (start_date NULL) du même catalogue
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
              routingReason = `session e-learning permanente du catalogue ${catalogId}`;
            }
          }

          // 3️⃣ Sinon : prochaine session INTER-ENTREPRISES datée non encore commencée du même catalogue
          //    (on exclut volontairement les sessions intra pour ne pas inscrire un client B2C dans une session privée)
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
              routingReason = `prochaine session inter-entreprises datée du catalogue ${catalogId}`;
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

          await (admin as any).from("order_items").upsert({
            woocommerce_order_id: wooOrderId,
            wc_order_id: order.id,
            wc_product_id: item.product_id,
            product_name: item.name,
            game_id: null,
            game_type: "formation",
            quantity: item.quantity,
            unit_price: item.price,
            line_total: parseFloat(item.total ?? "0"),
            kanban_status: "to_validate",
            block_reason: `[Formation] ${formationName} — ${reason}`,
            validation_status: "pending",
            raw_line_item: item,
          }, { onConflict: "woocommerce_order_id,wc_product_id", ignoreDuplicates: false });

          results.items_to_validate++;
          continue;
        }

        // 4️⃣ Ajoute le participant à la session trouvée
        const { data: existing } = await (admin as any)
          .from("training_participants")
          .select("id")
          .eq("training_id", training.id)
          .eq("email", customerEmail)
          .maybeSingle();

        // Déduit type_stagiaire_bpf depuis billing
        const billingCompany = (order.billing?.company ?? "").trim();
        const typeStagiaire = billingCompany ? "Entreprise" : "Particulier";

        // Adresse de facturation
        const billingAddr = order.billing as {
          address_1?: string; address_2?: string;
          city?: string; postcode?: string; country?: string;
        } | undefined;

        // Prix HT de la ligne
        const linePriceHt = parseFloat(item.total ?? "0");

        // Détermine si la session trouvée est e-learning (pour l'envoi du lien d'accès)
        const trainingFormat = (training.format_formation ?? "").toLowerCase();
        const isElearningSession = trainingFormat.includes("e_learning") || trainingFormat.includes("elearning") || trainingFormat.includes("classe_virtuelle");

        // Calcule le mode d'envoi de la convocation (aligné sur l'ajout manuel via getEmailMode)
        // - pas de date           → "programme" (sera envoyée par cron J-7)
        // - déjà commencée        → "non_envoye" (sauf formation ongoing → on envoie quand même)
        // - < 2 j                 → "manuel"
        // - 2 à 7 j               → "accueil_envoye" + envoi immédiat
        // - > 7 j                 → "programme"
        const computeEmailMode = (startStr: string | null, endStr: string | null) => {
          if (!startStr) return { status: "programme", sendNow: false, ongoing: false };
          const start = new Date(`${startStr}T00:00:00`);
          const end = endStr ? new Date(`${endStr}T23:59:59`) : start;
          const today = new Date();
          const msPerDay = 86_400_000;
          const days = Math.floor((start.getTime() - today.getTime()) / msPerDay);
          const ongoing = today >= start && today <= end;
          if (days <= 0) return { status: "non_envoye", sendNow: false, ongoing };
          if (days < 2)  return { status: "manuel",     sendNow: false, ongoing };
          if (days <= 7) return { status: "accueil_envoye", sendNow: true, ongoing };
          return { status: "programme", sendNow: false, ongoing };
        };
        const emailMode = computeEmailMode(training.start_date, training.end_date);
        const needsSurveyStatus = emailMode.status;
        // Aligné sur useAddParticipant : convocation envoyée immédiatement dès que
        // la formation n'est pas passée (ou si elle est en cours, mid-session add).
        // L'e-learning a son propre flux d'accès → pas de convocation classique.
        const shouldSendWelcomeNow = !isElearningSession
          && (emailMode.status !== "non_envoye" || emailMode.ongoing);

        const coachingTotal = formula.coaching_sessions_count ?? 0;
        const coachingDeadline = coachingTotal > 0
          ? (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })()
          : null;

        let participantId: string;
        if (existing) {
          participantId = existing.id;
        } else {
          const needsSurveyToken = crypto.randomUUID();
          const { data: participant, error: insertErr } = await (admin as any)
            .from("training_participants")
            .insert({
              training_id: training.id,
              first_name: order.billing?.first_name ?? null,
              last_name: order.billing?.last_name ?? null,
              email: customerEmail,
              company: billingCompany || null,
              company_address: [billingAddr?.address_1, billingAddr?.address_2].filter(Boolean).join(", ") || null,
              company_city: billingAddr?.city ?? null,
              company_zip: billingAddr?.postcode ?? null,
              type_stagiaire_bpf: typeStagiaire,
              sold_price_ht: linePriceHt || null,
              payment_mode: "online",
              needs_survey_token: needsSurveyToken,
              needs_survey_status: needsSurveyStatus,
              coaching_sessions_total: coachingTotal,
              coaching_sessions_completed: 0,
              coaching_deadline: coachingDeadline,
              formula: formula.name || null,
              formula_id: formula.id || null,
              notes: `Vente WooCommerce #${order.id} — ${item.name}`,
            })
            .select("id")
            .single();

          if (insertErr || !participant) {
            console.error("training_participants insert failed:", insertErr);
            throw new Error(`Participant insert failed: ${insertErr?.message ?? "no row returned"}`);
          }
          participantId = (participant as { id: string }).id;
          await (admin as any).from("questionnaire_besoins").insert({
            training_id: training.id,
            participant_id: participantId,
            token: needsSurveyToken,
            etat: needsSurveyStatus,
          });

          // Schedule needs_survey email (future non-e-learning, non-ongoing trainings)
          if (training.start_date && !isElearningSession && needsSurveyStatus !== "non_envoye" && !emailMode.ongoing) {
            try {
              const startDate = new Date(`${training.start_date}T00:00:00`);
              const surveyDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDaysArr);
              if (surveyDate > new Date()) {
                await (admin as any).from("scheduled_emails").insert({
                  training_id: training.id,
                  participant_id: participantId,
                  email_type: "needs_survey",
                  scheduled_for: `${surveyDate.toISOString().split("T")[0]}T09:00:00`,
                  status: "pending",
                });
              }
            } catch (schedErr) {
              console.error("Failed to schedule needs_survey email:", schedErr);
            }
          }

          // Schedule welcome email J-7 (when training is > 7 days away)
          if (training.start_date && !isElearningSession && emailMode.status === "programme") {
            try {
              const startDate = new Date(`${training.start_date}T00:00:00`);
              const welcomeDate = subtractWorkingDays(startDate, 7, workingDaysArr);
              if (welcomeDate > new Date()) {
                await (admin as any).from("scheduled_emails").insert({
                  training_id: training.id,
                  participant_id: participantId,
                  email_type: "welcome",
                  scheduled_for: `${welcomeDate.toISOString().split("T")[0]}T09:00:00`,
                  status: "pending",
                });
              }
            } catch (schedErr) {
              console.error("Failed to schedule welcome J-7 email:", schedErr);
            }
          }
        }

        // Schedule trainer_summary email (once per training, if not already scheduled)
        if (training.start_date && needsSurveyStatus !== "non_envoye") {
          try {
            const { data: existingTrainerSummary } = await (admin as any)
              .from("scheduled_emails")
              .select("id")
              .eq("training_id", training.id)
              .eq("email_type", "trainer_summary")
              .limit(1);
            if (!existingTrainerSummary || existingTrainerSummary.length === 0) {
              const startDate = new Date(`${training.start_date}T00:00:00`);
              const summaryDate = subtractWorkingDays(startDate, trainerSummaryDelay, workingDaysArr);
              if (summaryDate > new Date()) {
                await (admin as any).from("scheduled_emails").insert({
                  training_id: training.id,
                  email_type: "trainer_summary",
                  scheduled_for: `${summaryDate.toISOString().split("T")[0]}T07:00:00`,
                  status: "pending",
                });
              }
            }
          } catch (schedErr) {
            console.error("Failed to schedule trainer_summary email:", schedErr);
          }
        }

        // Envoi de la convocation (welcome email) pour les sessions non e-learning
        // selon le mode calculé : J-2 à J-7 OU formation déjà en cours.
        if (shouldSendWelcomeNow) {
          try {
            await (admin as any).functions.invoke("send-welcome-email", {
              body: { participantId, trainingId: training.id },
            });
          } catch (welcomeErr) {
            console.error("send-welcome-email failed:", welcomeErr);
          }
        }

        // Catch-up emargement pour les formations en cours (mid-session add)
        if (emailMode.ongoing && !isElearningSession) {
          try {
            const { data: sentSlots } = await (admin as any)
              .from("attendance_signatures")
              .select("schedule_date, period")
              .eq("training_id", training.id)
              .not("email_sent_at", "is", null);
            const uniqueSlots = Array.from(
              new Map(
                ((sentSlots ?? []) as Array<{ schedule_date: string; period: string }>).map(
                  (r) => [`${r.schedule_date}|${r.period}`, r],
                ),
              ).values(),
            );
            for (const slot of uniqueSlots) {
              try {
                await (admin as any).functions.invoke("send-attendance-signature-request", {
                  body: { trainingId: training.id, scheduleDate: slot.schedule_date, period: slot.period, participantIds: [participantId] },
                });
              } catch (slotErr) {
                console.error("Catch-up attendance slot failed:", slot, slotErr);
              }
            }
          } catch (catchUpErr) {
            console.error("Catch-up attendance failed:", catchUpErr);
          }
        }

        // Envoi accès uniquement pour les sessions e-learning
        if (isElearningSession) {
          if (elearningAccessMode === "magic_link") {
            await (admin as any).functions.invoke("send-learner-magic-link", {
              body: { email: customerEmail, trainingId: training.id },
            });
          } else {
            await (admin as any).functions.invoke("send-elearning-access", {
              body: { participantId, trainingId: training.id },
            });
          }
        }

        // Activity log
        await (admin as any).from("activity_logs").insert({
          action_type: "participant_added_from_woocommerce",
          recipient_email: customerEmail,
          details: {
            training_id: training.id,
            training_name: training.training_name,
            participant_id: participantId,
            woocommerce_order_id: order.id,
            woocommerce_product_id: item.product_id,
            routing_reason: routingReason,
            is_elearning: isElearningSession,
            source: "woocommerce_webhook",
          },
        });

        console.log(`Formation routed: ${formationName} → training ${training.id} (${routingReason})`);
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
        gameType = game.game_type;
        kanbanStatus = game.game_type === "supertilt"
          ? "to_ship"
          : game.game_type === "dropshipping"
          ? "dropshipping"
          : game.game_type === "location"
          ? "location_pending"
          : "received"; // partner or other
        results.items_processed++;
      }

      const itemPayload = {
        woocommerce_order_id: wooOrderId,
        wc_order_id: order.id,
        wc_product_id: item.product_id,
        product_name: item.name,
        game_id: gameId,
        game_type: gameType,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: parseFloat(item.total ?? "0"),
        kanban_status: kanbanStatus,
        block_reason: blockReason,
        validation_status: game ? "validated" : "pending",
        raw_line_item: item,
      };

      // Upsert by (wc_order_id, wc_product_id) — use delete+insert via unique constraint
      const { data: savedItem, error: itemErr } = await (admin as any)
        .from("order_items")
        .upsert(itemPayload, { onConflict: "woocommerce_order_id,wc_product_id", ignoreDuplicates: false })
        .select("id")
        .maybeSingle();

      if (itemErr) {
        // If no unique constraint, fall back to insert
        await (admin as any).from("order_items").insert(itemPayload);
      }

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
        await (admin as any).from("order_items").upsert({
          woocommerce_order_id: wooOrderId,
          wc_order_id: order.id,
          wc_product_id: item.product_id,
          product_name: item.name,
          game_id: null,
          game_type: null,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: parseFloat(item.total ?? "0"),
          kanban_status: "to_validate",
          block_reason: `Erreur de traitement automatique : ${msg}`,
          validation_status: "pending",
          raw_line_item: item,
        }, { onConflict: "woocommerce_order_id,wc_product_id", ignoreDuplicates: false });
        results.items_to_validate++;
      }
    }

    // ── Safety net: if the order produced no order_items at all,
    //    insert orphan rows so it surfaces in the WooCommerce inbox.
    const { count: itemsCount } = await (admin as any)
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("woocommerce_order_id", wooOrderId);

    if ((itemsCount ?? 0) === 0 && (order.line_items?.length ?? 0) > 0) {
      console.warn(`[supertilt-webhook] Order #${order.id} produced 0 order_items — inserting orphans`);
      for (const item of order.line_items ?? []) {
        await (admin as any).from("order_items").upsert({
          woocommerce_order_id: wooOrderId,
          wc_order_id: order.id,
          wc_product_id: item.product_id,
          product_name: item.name,
          game_id: null,
          game_type: null,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: parseFloat(item.total ?? "0"),
          kanban_status: "to_validate",
          block_reason: `Commande non routée automatiquement — aucune ligne n'a pu être traitée (produit #${item.product_id})`,
          validation_status: "pending",
          raw_line_item: item,
        }, { onConflict: "woocommerce_order_id,wc_product_id", ignoreDuplicates: false });
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
    await updateLog({ status: "error", response_status: 500, error_message: message, processed_at: new Date().toISOString() });
    return new Response(JSON.stringify({ error: message, log_id: logId }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
