import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { appendRowToSheet } from "../_shared/google-sheets-helper.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1tyKULmXGvoKse-09VkIQuVNN-hCMZjFjlEafA7IOSqs/edit?gid=1910192676#gid=1910192676";
    const horodatage = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
    await appendRowToSheet(admin, sheetUrl, [
      horodatage,
      "TEST — Echo (test manuel)",
      25.00,
      0.63, // Stripe perso 1,5%+0,25€ sur 25,30 TTC
      "",
      5.00,
      5.00,
      1.00,
    ]);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
