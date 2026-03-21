import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google Maps API key from app_settings
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "google_maps_api_key")
      .maybeSingle();

    const apiKey = setting?.setting_value;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured in app_settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { originLat, originLon, destLat, destLon } = await req.json();

    if (!originLat || !originLon || !destLat || !destLon) {
      return new Response(
        JSON.stringify({ error: "Missing coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Google Routes API
    const routesResponse = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: originLat, longitude: originLon },
            },
          },
          destination: {
            location: {
              latLng: { latitude: destLat, longitude: destLon },
            },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          extraComputations: ["TOLLS"],
        }),
      }
    );

    if (!routesResponse.ok) {
      const errorText = await routesResponse.text();
      console.error("Google Routes API error:", errorText);
      return new Response(
        JSON.stringify({ error: `Google Routes API error [${routesResponse.status}]` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const routesData = await routesResponse.json();

    if (!routesData.routes || routesData.routes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No route found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const route = routesData.routes[0];
    const distanceKm = Math.round((route.distanceMeters || 0) / 1000);

    // Duration comes as "123s" string
    const durationStr = route.duration || "0s";
    const durationSeconds = parseInt(durationStr.replace("s", ""), 10) || 0;
    const durationMinutes = Math.round(durationSeconds / 60);
    const durationHours = +(durationSeconds / 3600).toFixed(1);

    // Tolls
    let tollCostEur = 0;
    const tollInfo = route.travelAdvisory?.tollInfo;
    if (tollInfo?.estimatedPrice && tollInfo.estimatedPrice.length > 0) {
      for (const price of tollInfo.estimatedPrice) {
        if (price.currencyCode === "EUR") {
          tollCostEur += parseFloat(price.units || "0") + 
            (price.nanos ? price.nanos / 1_000_000_000 : 0);
        }
      }
      tollCostEur = Math.round(tollCostEur * 100) / 100;
    }

    return new Response(
      JSON.stringify({
        distanceKm,
        durationMinutes,
        durationHours,
        tollCostEur,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("google-routes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
