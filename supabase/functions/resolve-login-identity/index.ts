import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Service de résolution d'identité (chapitre 6 de la spécification de connexion).
 *
 * Entrée : une adresse email. Sortie : un état d'aiguillage, et rien d'autre.
 * Ni nom, ni rôle, ni formation, ni identifiant de compte (RG-26). Un compte
 * staff répond `password` comme un autre : le rôle n'est pas divulgué avant
 * authentification.
 *
 * L'adresse n'est jamais journalisée en clair : seule son empreinte part en base.
 */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const { email } = await req.json() as { email?: string };
    const normalized = (email ?? "").trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      return createJsonResponse({ state: "unknown" });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await admin.rpc("resolve_login_identity", {
      p_email: normalized,
      p_email_hash: await sha256Hex(normalized),
      p_ip: ip,
    });

    if (error) {
      return createErrorResponse(error.message, 500, { cause: error, fn: "resolve-login-identity" });
    }

    return createJsonResponse({ state: data ?? "unknown" });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "Erreur inconnue",
      500,
      { cause: error, fn: "resolve-login-identity" },
    );
  }
});
