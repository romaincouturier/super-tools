/**
 * supertilt-confirm-shipped
 *
 * Public endpoint (no JWT) called from the dropshipping email button.
 * Validates an HMAC-signed token and marks the order item as shipped
 * (equivalent to clicking "Confirmé envoyé" in the kanban).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function htmlPage(title: string, message: string, ok: boolean): Response {
  const color = ok ? "#16a34a" : "#dc2626";
  const icon = ok ? "✓" : "✕";
  const body = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f9fafb;margin:0;padding:48px 16px;color:#111827}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
  .icon{width:64px;height:64px;border-radius:50%;background:${color};color:#fff;font-size:36px;line-height:64px;margin:0 auto 24px}
  h1{font-size:22px;margin:0 0 12px}
  p{color:#4b5563;line-height:1.5;margin:0}
</style></head><body>
<div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p></div>
</body></html>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const sig = url.searchParams.get("sig");
    if (!id || !sig) {
      return htmlPage("Lien invalide", "Le lien de confirmation est incomplet.", false);
    }
    const expected = await hmac(id);
    if (expected !== sig) {
      return htmlPage("Lien invalide", "La signature du lien ne correspond pas.", false);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existing, error: getErr } = await (admin as any)
      .from("order_items")
      .select("id, shipped_confirmed_at")
      .eq("id", id)
      .maybeSingle();

    if (getErr || !existing) {
      return htmlPage("Commande introuvable", "Impossible de retrouver cette commande.", false);
    }

    if (existing.shipped_confirmed_at) {
      return htmlPage(
        "D&eacute;j&agrave; confirm&eacute;",
        `Cet envoi a d&eacute;j&agrave; &eacute;t&eacute; confirm&eacute; le ${new Date(existing.shipped_confirmed_at).toLocaleDateString("fr-FR")}. Merci&nbsp;!`,
        true,
      );
    }

    const { error: updErr } = await (admin as any)
      .from("order_items")
      .update({ shipped_confirmed_at: new Date().toISOString() })
      .eq("id", id);

    if (updErr) {
      return htmlPage("Erreur", "Impossible d'enregistrer la confirmation. R&eacute;essaie ou pr&eacute;viens-moi.", false);
    }

    return htmlPage("Envoi confirm&eacute; &#10024;", "Merci&nbsp;! L'envoi a bien &eacute;t&eacute; enregistr&eacute; c&ocirc;t&eacute; SuperTilt.", true);
  } catch (_e) {
    return htmlPage("Erreur", "Une erreur inattendue s'est produite.", false);
  }
});
