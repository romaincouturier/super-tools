import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { passwordLinkState, sha256Hex } from "../_shared/password-reset.ts";

/**
 * Lien SuperTools de mot de passe (`?link=`), appelé sans session.
 *  - action "redeem" (clic « Continuer ») : si valide, marque le lien utilisé
 *    et renvoie un token_hash natif à vérifier aussitôt par le navigateur ;
 *  - action "resend" (lien expiré ou déjà utilisé) : renvoie un nouveau lien
 *    de 24 h à l'adresse du lien, via send-password-reset (quota inclus).
 * L'adresse email n'est jamais renvoyée au navigateur.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;
  try {
    const { link, action } = await req.json();
    if (typeof link !== "string" || !/^[a-f0-9]{64}$/.test(link)) return json({ status: "invalid" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await admin
      .from("password_setup_links")
      .select("id, email, expires_at, used_at")
      .eq("token_hash", await sha256Hex(link))
      .maybeSingle();
    if (!row) return json({ status: "invalid" });

    if (action === "resend") {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          ...(req.headers.get("x-forwarded-for") && { "x-forwarded-for": req.headers.get("x-forwarded-for")! }),
        },
        body: JSON.stringify({ email: row.email }),
      });
      return json({ status: res.ok ? "sent" : "error" }, res.ok ? 200 : 502);
    }

    const state = passwordLinkState(row);
    if (state !== "valid") return json({ status: state });

    // Marquage atomique : un double clic ne produit qu'un seul jeton natif.
    const { data: claimed } = await admin
      .from("password_setup_links")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return json({ status: "used" });

    const urls = await getAppUrls();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: row.email,
      options: { redirectTo: `${urls.app_url}/connexion/reinitialisation` },
    });
    if (error || !data?.properties?.hashed_token) {
      await admin.from("password_setup_links").update({ used_at: null }).eq("id", row.id);
      return json({ status: "error" }, 502);
    }
    return json({ status: "valid", token_hash: data.properties.hashed_token });
  } catch (error) {
    console.error("redeem-password-link:", error instanceof Error ? error.message : error);
    return json({ status: "error" }, 500);
  }
});
