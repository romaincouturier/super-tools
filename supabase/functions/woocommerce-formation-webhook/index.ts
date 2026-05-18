/**
 * woocommerce-formation-webhook
 *
 * Receives WooCommerce order.completed webhook events.
 * For each line item whose woocommerce_product_id matches a formation_formula:
 *  - Finds the next upcoming inter-company training session
 *  - Adds the buyer as a participant
 *  - Sends a magic link (or WooCommerce access email depending on elearning_access_mode)
 * If no session exists yet, queues the order in woocommerce_pending_formations.
 *
 * WooCommerce webhook configuration:
 *  Topic: order.completed
 *  Delivery URL: <supabase_url>/functions/v1/woocommerce-formation-webhook
 *  Secret: stored in app_settings as wc_webhook_secret
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────

async function verifyWoocommerceSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === signature;
  } catch {
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const rawBody = await req.text();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Load settings ────────────────────────────────────────────────────────
  const { data: settingsRows } = await admin
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["wc_webhook_secret", "elearning_access_mode"]);

  const getSetting = (k: string) =>
    (settingsRows as Array<{ setting_key: string; setting_value: string }>)
      ?.find((s) => s.setting_key === k)?.setting_value ?? "";

  const webhookSecret = getSetting("wc_webhook_secret");
  const accessMode = getSetting("elearning_access_mode") || "woocommerce";

  // ── Signature verification ───────────────────────────────────────────────
  if (webhookSecret) {
    const signature = req.headers.get("x-wc-webhook-signature") ?? "";
    const valid = await verifyWoocommerceSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.warn("Invalid WooCommerce webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let order: Record<string, unknown>;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orderId = order.id as number;
  const billing = order.billing as {
    first_name?: string;
    last_name?: string;
    email?: string;
    company?: string;
  } | undefined;
  const lineItems = (order.line_items as Array<{ product_id: number }>) ?? [];
  const customerEmail = (billing?.email ?? "").trim().toLowerCase();

  if (!customerEmail) {
    return new Response(JSON.stringify({ error: "No customer email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: unknown[] = [];

  for (const item of lineItems) {
    const productId = item.product_id;
    if (!productId) continue;

    const result = await processLineItem({
      admin,
      orderId,
      productId,
      customerEmail,
      customerFirstName: billing?.first_name ?? "",
      customerLastName: billing?.last_name ?? "",
      accessMode,
    });
    results.push(result);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ── Per-line-item processing ──────────────────────────────────────────────────

async function processLineItem(opts: {
  admin: ReturnType<typeof createClient>;
  orderId: number;
  productId: number;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  accessMode: string;
}): Promise<{ productId: number; outcome: string; trainingId?: string }> {
  const {
    admin, orderId, productId, customerEmail,
    customerFirstName, customerLastName, accessMode,
  } = opts;

  // 1. Find matching formation_formula
  const { data: formula } = await admin
    .from("formation_formulas")
    .select("id, name, formation_config_id, formation_configs(formation_name)")
    .eq("woocommerce_product_id", productId)
    .maybeSingle();

  if (!formula) {
    console.log(`No formula found for product_id=${productId}`);
    return { productId, outcome: "no_formula" };
  }

  const formationName = (formula.formation_configs as { formation_name: string } | null)?.formation_name ?? "";

  // 2. Find the next upcoming inter-company training for this formation
  const today = new Date().toISOString().split("T")[0];
  const { data: training } = await admin
    .from("trainings")
    .select("id, training_name, start_date, end_date, format_formation")
    .ilike("training_name", `%${formationName}%`)
    .ilike("format_formation", "%inter%")
    .eq("is_cancelled", false)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!training) {
    // No upcoming session → queue
    await admin.from("woocommerce_pending_formations").insert({
      woocommerce_order_id: orderId,
      woocommerce_product_id: productId,
      customer_email: customerEmail,
      customer_first_name: customerFirstName || null,
      customer_last_name: customerLastName || null,
      formation_name: formationName,
      reason: "no_matching_session",
      raw_payload: { product_id: productId, formula_id: formula.id, formula_name: formula.name },
      status: "pending",
    });

    // Log activity for admin visibility
    await admin.from("activity_logs").insert({
      action_type: "woocommerce_formation_pending",
      recipient_email: customerEmail,
      details: {
        woocommerce_order_id: orderId,
        woocommerce_product_id: productId,
        formation_name: formationName,
        reason: "no_matching_session",
      },
    });

    console.log(`Queued pending formation for product_id=${productId}, email=${customerEmail}`);
    return { productId, outcome: "queued" };
  }

  // 3. Avoid duplicate participant
  const { data: existing } = await admin
    .from("training_participants")
    .select("id")
    .eq("training_id", training.id)
    .eq("email", customerEmail)
    .maybeSingle();

  let participantId: string;

  if (existing) {
    participantId = existing.id;
    console.log(`Participant already in training ${training.id} for ${customerEmail}`);
  } else {
    const needsSurveyToken = crypto.randomUUID();
    const { data: participant, error: participantErr } = await admin
      .from("training_participants")
      .insert({
        training_id: training.id,
        first_name: customerFirstName || null,
        last_name: customerLastName || null,
        email: customerEmail,
        needs_survey_token: needsSurveyToken,
        needs_survey_status: "non_envoye",
        coaching_sessions_total: 0,
        coaching_sessions_completed: 0,
        payment_mode: "online",
        formula: formula.name || null,
        formula_id: formula.id || null,
      })
      .select("id")
      .single();

    if (participantErr || !participant) {
      console.error("Failed to insert participant:", participantErr);
      return { productId, outcome: "error", trainingId: training.id };
    }

    participantId = participant.id;

    // Create questionnaire_besoins
    await admin.from("questionnaire_besoins").insert({
      training_id: training.id,
      participant_id: participantId,
      token: needsSurveyToken,
      etat: "non_envoye",
    });

    await admin.from("activity_logs").insert({
      action_type: "participant_added_from_woocommerce",
      recipient_email: customerEmail,
      details: {
        training_id: training.id,
        training_name: training.training_name,
        participant_id: participantId,
        woocommerce_order_id: orderId,
        woocommerce_product_id: productId,
        source: "woocommerce_webhook",
      },
    });
  }

  // 4. Send access email depending on mode
  if (accessMode === "magic_link") {
    await admin.functions.invoke("send-learner-magic-link", {
      body: {
        email: customerEmail,
        trainingId: training.id,
        participantId,
      },
    });
  } else {
    await admin.functions.invoke("send-elearning-access", {
      body: { participantId, trainingId: training.id },
    });
  }

  return { productId, outcome: "processed", trainingId: training.id };
}
