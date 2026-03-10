import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
 * 1. Looks up the participant's formula (if any) or the catalog entry to get the woocommerce_product_id
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

    // Fetch training
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return createErrorResponse("Formation introuvable", 404);
    }

    // Fetch catalog entry separately to get WooCommerce product ID
    if (!training.catalog_id) {
      return createErrorResponse(
        "Cette formation n'est pas liée à une entrée du catalogue. " +
        "Veuillez d'abord associer la formation à une entrée du catalogue contenant un WooCommerce Product ID.",
        400
      );
    }

    const { data: catalog, error: catalogError } = await supabase
      .from("formation_configs")
      .select("*")
      .eq("id", training.catalog_id)
      .single();

    if (catalogError || !catalog) {
      return createErrorResponse("Entrée catalogue introuvable", 404);
    }

    // Look up woocommerce_product_id from the participant's formula
    let woocommerceProductId: number | null = null;

    if (participant.formula_id) {
      // Direct lookup by formula_id (reliable)
      const { data: formula } = await supabase
        .from("formation_formulas")
        .select("woocommerce_product_id, prix, name")
        .eq("id", participant.formula_id)
        .maybeSingle();

      if (formula?.woocommerce_product_id) {
        woocommerceProductId = formula.woocommerce_product_id;
      }
    } else if (participant.formula) {
      // Fallback: name-based lookup for old participants without formula_id
      const { data: formula } = await supabase
        .from("formation_formulas")
        .select("woocommerce_product_id, prix, name")
        .eq("formation_config_id", training.catalog_id)
        .eq("name", participant.formula)
        .maybeSingle();

      if (formula?.woocommerce_product_id) {
        woocommerceProductId = formula.woocommerce_product_id;
      }
    }

    // Fallback to catalog-level product ID if no formula-specific one found
    if (!woocommerceProductId) {
      woocommerceProductId = catalog.woocommerce_product_id;
      console.log(`Falling back to catalog woocommerce_product_id: ${woocommerceProductId}`);
    }

    if (!woocommerceProductId) {
      const source = participant.formula
        ? `la formule "${participant.formula}" ni dans le catalogue`
        : "le catalogue";
      return createErrorResponse(
        `Aucun ID produit WooCommerce configuré pour cette formation dans ${source}. ` +
        "Veuillez d'abord renseigner le WooCommerce Product ID.",
        400
      );
    }

    // WooCommerce credentials from app_settings table
    const { data: wcSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "woocommerce_store_url",
        "woocommerce_consumer_key",
        "woocommerce_consumer_secret",
      ]);

    const settingsMap: Record<string, string> = {};
    (wcSettings || []).forEach((s: any) => {
      if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
    });

    const storeUrl = settingsMap["woocommerce_store_url"] || Deno.env.get("WOOCOMMERCE_STORE_URL");
    const consumerKey = settingsMap["woocommerce_consumer_key"] || Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
    const consumerSecret = settingsMap["woocommerce_consumer_secret"] || Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return createErrorResponse(
        "Les identifiants WooCommerce ne sont pas configurés. " +
        "Veuillez les renseigner dans Paramètres → Intégrations → WooCommerce.",
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
    const { error: insertError } = await supabase
      .from("woocommerce_coupons")
      .insert({
        coupon_code: couponCode,
        woocommerce_coupon_id: wcCouponId,
        participant_id: participantId,
        training_id: trainingId,
        catalog_id: training.catalog_id,
        woocommerce_product_id: woocommerceProductId,
        discount_type: "percent",
        amount: 100,
        usage_limit: 1,
        expiry_date: expiryStr,
        email_restriction: participant.email,
        status: couponStatus,
        error_message: errorMessage,
      });

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
