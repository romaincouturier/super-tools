/**
 * Process Mission Testimonials
 *
 * Cron-triggered. No email is generated or sent anymore: once a mission has
 * ended for X days (delay_mission_google_review_days), one signal per contact
 * is created in testimonial_requests. Requests are then written by hand.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getSupabaseClient, corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/mod.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const supabase = getSupabaseClient();
    const { data: setting } = await supabase
      .from("app_settings").select("setting_value")
      .eq("setting_key", "delay_mission_google_review_days").maybeSingle();
    const delay = parseInt(setting?.setting_value || "2", 10) || 2;

    const cutoff = new Date(Date.now() - delay * 86400000).toISOString().slice(0, 10);
    const { data: missions, error } = await (supabase as any)
      .from("missions")
      .select("id")
      .not("end_date", "is", null)
      .lte("end_date", cutoff)
      .eq("testimonial_status", "pending");
    if (error) return json({ error: error.message }, 500);

    let created = 0;
    for (const mission of missions || []) {
      const { data: contacts } = await (supabase as any)
        .from("mission_contacts").select("first_name, last_name, email").eq("mission_id", mission.id);
      const rows = (contacts || []).filter((c: any) => c.email).map((c: any) => ({
        mission_id: mission.id,
        contact_email: c.email,
        contact_name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
        source: "auto",
      }));
      const { data: existing } = await (supabase as any)
        .from("testimonial_requests").select("contact_email").eq("mission_id", mission.id);
      const seen = new Set((existing || []).map((e: any) => String(e.contact_email).toLowerCase()));
      const fresh = rows.filter((r: any) => !seen.has(r.contact_email.toLowerCase()) && seen.add(r.contact_email.toLowerCase()));
      const { error: insErr } = fresh.length
        ? await (supabase as any).from("testimonial_requests").insert(fresh)
        : { error: null };
      if (insErr) { console.error(`mission ${mission.id}:`, insErr.message); continue; }
      await (supabase as any).from("missions").update({ testimonial_status: "completed" }).eq("id", mission.id);
      created += fresh.length;
    }
    return json({ success: true, signalsCreated: created });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
