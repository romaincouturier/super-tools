// Brevo statistics proxy
// Fetches sent email-campaign statistics and the total contact count from the
// Brevo API, using the key stored in app_settings (brevo_api_key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";

const BREVO_BASE = "https://api.brevo.com/v3";

type GlobalStats = {
  sent?: number;
  delivered?: number;
  uniqueViews?: number;
  uniqueClicks?: number;
  unsubscriptions?: number;
  hardBounces?: number;
  softBounces?: number;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    // ── Auth: require a Supabase JWT ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return createErrorResponse("Missing Authorization header", 401);
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 100, 100);

    // ── API key from app_settings ─────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: setting } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "brevo_api_key")
      .maybeSingle();

    const apiKey = setting?.setting_value?.trim();
    if (!apiKey) {
      return createErrorResponse(
        "Clé API Brevo non configurée. Renseignez-la dans Paramètres → Intégrations.",
        400,
      );
    }

    const brevoHeaders = { "api-key": apiKey, "Accept": "application/json" };

    // ── Sent campaigns with stats + total contacts ────────────────────────────
    const campaignsParams = new URLSearchParams({
      type: "classic",
      status: "sent",
      statistics: "globalStats",
      limit: String(limit),
      offset: "0",
      sort: "desc",
    });
    const [campaignsRes, contactsRes] = await Promise.all([
      fetch(`${BREVO_BASE}/emailCampaigns?${campaignsParams}`, { headers: brevoHeaders }),
      fetch(`${BREVO_BASE}/contacts?limit=1&offset=0`, { headers: brevoHeaders }),
    ]);

    if (!campaignsRes.ok) {
      const errorText = await campaignsRes.text();
      console.error("Brevo campaigns error:", campaignsRes.status, errorText);
      if (campaignsRes.status === 401) {
        return createErrorResponse("Clé API Brevo invalide. Vérifiez-la dans Paramètres → Intégrations.", 401);
      }
      return createErrorResponse(`Brevo API error: ${campaignsRes.status}`, campaignsRes.status);
    }

    const campaignsData = await campaignsRes.json();
    const contactsCount = contactsRes.ok ? Number((await contactsRes.json())?.count ?? 0) : null;

    const campaigns = (Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns : []).map(
      (c: { id?: number; name?: string; subject?: string; sentDate?: string; statistics?: { globalStats?: GlobalStats } }) => {
        const s = c.statistics?.globalStats ?? {};
        return {
          id: c.id,
          name: c.name ?? "",
          subject: c.subject ?? "",
          sentDate: c.sentDate ?? "",
          sent: s.sent ?? 0,
          delivered: s.delivered ?? 0,
          uniqueViews: s.uniqueViews ?? 0,
          uniqueClicks: s.uniqueClicks ?? 0,
          unsubscriptions: s.unsubscriptions ?? 0,
          hardBounces: s.hardBounces ?? 0,
          softBounces: s.softBounces ?? 0,
        };
      },
    );

    return createJsonResponse({ contactsCount, campaigns });
  } catch (error) {
    console.error("brevo-statistics error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
