/**
 * supertilt-confirm-shipped
 *
 * Public endpoint (no JWT) called from the dropshipping email button.
 * Validates an HMAC-signed token and marks the order item as shipped
 * (equivalent to clicking "Confirmé envoyé" in the kanban).
 *
 * Supabase Edge Runtime forces `content-type: text/plain` + a sandbox CSP on
 * responses from public functions, which breaks HTML rendering in the browser.
 * To work around this we redirect (303) to a public frontend page hosted on
 * the app's own domain, which is free of those overrides.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAppUrls } from "../_shared/app-urls.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmac(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SUPABASE_SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`shipped:${id}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function redirectToStatus(status: string, extra: Record<string, string> = {}): Promise<Response> {
  const { app_url } = await getAppUrls();
  const target = new URL("/supertilt/confirmation-envoi", app_url);
  target.searchParams.set("status", status);
  for (const [k, v] of Object.entries(extra)) target.searchParams.set(k, v);
  return new Response(null, {
    status: 303,
    headers: { location: target.toString(), "cache-control": "no-store" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const sig = url.searchParams.get("sig");
    if (!id || !sig) return await redirectToStatus("invalid_link");

    const expected = await hmac(id);
    if (expected !== sig) return await redirectToStatus("invalid_signature");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existing, error: getErr } = await (admin as any)
      .from("order_items")
      .select("id, shipped_confirmed_at")
      .eq("id", id)
      .maybeSingle();

    if (getErr || !existing) return await redirectToStatus("not_found");

    if (existing.shipped_confirmed_at) {
      return await redirectToStatus("already", { at: existing.shipped_confirmed_at });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await (admin as any)
      .from("order_items")
      .update({ shipped_confirmed_at: now })
      .eq("id", id);

    if (updErr) return await redirectToStatus("update_error");

    return await redirectToStatus("confirmed", { at: now });
  } catch (e) {
    await reportEdgeError(e, { fn: "supertilt-confirm-shipped" });
    return await redirectToStatus("unexpected_error");
  }
});
