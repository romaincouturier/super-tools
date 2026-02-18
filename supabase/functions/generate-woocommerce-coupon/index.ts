import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
} from "../_shared/mod.ts";

/**
 * Generate a WooCommerce coupon for manual e-learning enrollment.
 *
 * Expected body:
 *   participantId: string (UUID)
 *   trainingId: string (UUID)
 *
 * The function:
 * 1. Looks up the training's catalog entry to get the woocommerce_product_id
 * 2. Generates a unique coupon code
 * 3. Creates the coupon in WooCommerce via REST API
 * 4. Records the coupon in the woocommerce_coupons table
 * 5. Returns the coupon_code
 */

function generateCouponCode(firstName: string): string {
  const prefix = "ELEARN";
  const cleanName = (firstName || "GUEST")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${cleanName}-${random}`;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { participantId, trainingId } = await req.json();

    if (!participantId || !trainingId) {
      return createErrorResponse("participantId and trainingId are required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch participant
    const { data: participant, error: participantError } = await supabase
      .from("training_participants")
      .select("*")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      return createErrorResponse("Participant introuvable", 404);
    }

    // Fetch training with catalog info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*, formation_configs(*)")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return createErrorResponse("Formation introuvable", 404);
    }

    // Get WooCommerce product ID from catalog
    const catalog = (training as any).formation_configs;
    const woocommerceProductId = catalog?.woocommerce_product_id;

    if (!woocommerceProductId) {
      return createErrorResponse(
        "Aucun ID produit WooCommerce configuré pour cette formation dans le catalogue. " +
        "Veuillez d'abord renseigner le WooCommerce Product ID dans le catalogue.",
        400
      );
    }

    // WooCommerce credentials from secrets
    const storeUrl = Deno.env.get("WOOCOMMERCE_STORE_URL");
    const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return createErrorResponse(
        "Les identifiants WooCommerce ne sont pas configurés. " +
        "Veuillez configurer WOOCOMMERCE_STORE_URL, WOOCOMMERCE_CONSUMER_KEY et WOOCOMMERCE_CONSUMER_SECRET dans les secrets Supabase.",
        500
      );
    }

    // Generate unique coupon code
    const couponCode = generateCouponCode(participant.first_name);

    // Calculate expiry date (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    const expiryStr = expiryDate.toISOString().split("T")[0];

    // Create coupon in WooCommerce
    const wcPayload = {
      code: couponCode,
      discount_type: "percent",
      amount: "100",
      individual_use: true,
      usage_limit: 1,
      usage_limit_per_user: 1,
      date_expires: expiryStr,
      product_ids: [woocommerceProductId],
      email_restrictions: [participant.email],
      description: `Coupon généré pour ${participant.first_name || ""} ${participant.last_name || ""} - Formation: ${training.training_name}`,
    };

    console.log(`Creating WooCommerce coupon: ${couponCode} for product ${woocommerceProductId}`);

    const wcUrl = `${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/coupons`;
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const wcResponse = await fetch(wcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wcPayload),
    });

    let wcCouponId: number | null = null;
    let couponStatus: string = "active";
    let errorMessage: string | null = null;

    if (wcResponse.ok) {
      const wcData = await wcResponse.json();
      wcCouponId = wcData.id;
      console.log(`WooCommerce coupon created: ID ${wcCouponId}, code ${couponCode}`);
    } else {
      const wcError = await wcResponse.text();
      console.error(`WooCommerce API error: ${wcResponse.status} - ${wcError}`);
      couponStatus = "failed";
      errorMessage = `WooCommerce API ${wcResponse.status}: ${wcError}`;
    }

    // Record coupon in database
    const { data: couponRecord, error: insertError } = await supabase
      .from("woocommerce_coupons")
      .insert({
        coupon_code: couponCode,
        woocommerce_coupon_id: wcCouponId,
        participant_id: participantId,
        training_id: trainingId,
        catalog_id: training.catalog_id || null,
        woocommerce_product_id: woocommerceProductId,
        discount_type: "percent",
        amount: 100,
        usage_limit: 1,
        expiry_date: expiryStr,
        email_restriction: participant.email,
        status: couponStatus,
        error_message: errorMessage,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to record coupon in database:", insertError);
    }

    // Log activity
    try {
      await supabase.from("activity_logs").insert({
        action_type: "woocommerce_coupon_generated",
        recipient_email: participant.email,
        details: {
          coupon_code: couponCode,
          woocommerce_coupon_id: wcCouponId,
          training_id: trainingId,
          training_name: training.training_name,
          participant_id: participantId,
          participant_name: `${participant.first_name || ""} ${participant.last_name || ""}`.trim(),
          woocommerce_product_id: woocommerceProductId,
          status: couponStatus,
        },
      });
    } catch (logError) {
      console.warn("Failed to log activity:", logError);
    }

    if (couponStatus === "failed") {
      return createErrorResponse(
        `Coupon créé localement mais erreur WooCommerce: ${errorMessage}`,
        502
      );
    }

    return createJsonResponse({
      success: true,
      coupon_code: couponCode,
      woocommerce_coupon_id: wcCouponId,
      expiry_date: expiryStr,
      message: `Coupon ${couponCode} créé avec succès`,
    });
  } catch (error: unknown) {
    console.error("Error in generate-woocommerce-coupon:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return createErrorResponse(errorMessage, 500);
  }
});
