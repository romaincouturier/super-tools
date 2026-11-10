import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { generateHash, getClientIp } from "../_shared/crypto.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { attestationSections, effectiveStatus } from "../_shared/execution-attestation.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  const pre = handleCorsPreflightIfNeeded(req);
  if (pre) return pre;
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : "";
    const action = body.action === "refuse" ? "refuse" : "get";
    if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "Lien invalide" }, 404);

    const supabase = getSupabaseClient();
    const ip = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_formulaire_rate_limit", { p_ip_address: `attestation:${ip}`, p_max_requests: 40, p_window_seconds: 600 });
    if (allowed === false) return json({ error: "Trop de tentatives, réessayez plus tard" }, 429);

    const { data: a } = await supabase.from("execution_attestations").select("*").eq("token_hash", await generateHash(token)).maybeSingle();
    if (!a) return json({ error: "Lien invalide" }, 404);
    const status = effectiveStatus(a);

    if (action === "refuse") {
      if (status !== "sent") return json({ error: "Cette attestation ne peut plus être refusée", status }, 400);
      const reason = String(body.reason ?? "").trim().slice(0, 2000);
      if (!reason) return json({ error: "Merci d'indiquer un motif" }, 400);
      const events = [...(a.journey_events ?? []), { event: "refused", timestamp: new Date().toISOString(), details: { ip_address: ip } }];
      await supabase.from("execution_attestations").update({ status: "refused", refused_at: new Date().toISOString(), refusal_reason: reason, journey_events: events }).eq("id", a.id).eq("status", "sent");
      return json({ success: true });
    }

    if (status === "sent") {
      const first = !(a.journey_events ?? []).some((e: { event: string }) => e.event === "first_link_opened");
      const events = [...(a.journey_events ?? []), { event: first ? "first_link_opened" : "link_reopened", timestamp: new Date().toISOString(), details: { ip_address: ip } }];
      await supabase.from("execution_attestations").update({ journey_events: events }).eq("id", a.id);
    }
    return json({
      status,
      signed_at: a.signed_at,
      expires_at: a.expires_at,
      signer_name: a.signer_name,
      signer_function: a.signer_function,
      is_public_entity: a.is_public_entity,
      public_entity_name: a.public_entity_name,
      sections: status === "sent" ? attestationSections(a) : [],
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur inattendue" }, 500);
  }
});
