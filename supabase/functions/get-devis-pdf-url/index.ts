import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Extract bucket + path from a Supabase storage URL. */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

/**
 * Public endpoint: given a devis signature token, return a short-lived signed URL
 * for the quote PDF. The devis-pdfs bucket is private, so stored public URLs
 * are no longer readable by anonymous recipients.
 */
serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { token, signed } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Token requis" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: sig, error } = await supabase
      .from("devis_signatures")
      .select("id, pdf_url, signed_pdf_url")
      .eq("token", token)
      .maybeSingle();

    if (error || !sig) return json({ error: "Devis introuvable" }, 404);

    const source = signed ? (sig.signed_pdf_url || sig.pdf_url) : sig.pdf_url;
    if (!source) return json({ error: "PDF indisponible" }, 404);

    const info = parseStorageUrl(source);
    if (!info) return json({ pdf_url: source, signed: false });

    const { data: urlData, error: signErr } = await supabase.storage
      .from(info.bucket)
      .createSignedUrl(info.path, 3600);

    if (signErr || !urlData?.signedUrl) return json({ error: "URL indisponible" }, 500);

    return json({ pdf_url: urlData.signedUrl, signed: true });
  } catch (e) {
    console.error("get-devis-pdf-url error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});
