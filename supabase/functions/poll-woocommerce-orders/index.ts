import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings } = await admin
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["woocommerce_store_url", "woocommerce_consumer_key", "woocommerce_consumer_secret"]);

    const get = (key: string) => settings?.find((s) => s.setting_key === key)?.setting_value ?? "";
    const storeUrl = get("woocommerce_store_url");
    const consumerKey = get("woocommerce_consumer_key");
    const consumerSecret = get("woocommerce_consumer_secret");

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "WooCommerce credentials not fully configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO Sprint 4: fetch new orders from WooCommerce REST API, store in game_sales table
    console.log("poll-woocommerce-orders: ready — implementation pending Sprint 4");

    await admin
      .from("polling_cursors")
      .update({ last_synced_at: new Date().toISOString(), status: "idle" })
      .eq("source", "woocommerce");

    return new Response(
      JSON.stringify({ ok: true, message: "poll-woocommerce-orders stub — Sprint 4 pending" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("poll-woocommerce-orders error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
