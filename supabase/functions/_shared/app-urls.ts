/**
 * App URLs Module
 *
 * Centralizes all application URLs by reading them from app_settings.
 * Cached for the lifetime of the edge function invocation.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULTS: Record<string, string> = {
  app_url: "https://super-tools.lovable.app",
  website_url: "https://www.supertilt.fr",
  blog_url: "https://supertilt.fr/blog/",
  youtube_url: "https://www.youtube.com/@supertilt",
  google_maps_api_key: "AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8",
  qualiopi_certificate_path: "certificat-qualiopi/Certificat QUALIOPI v3.pdf",
};

const URL_KEYS = Object.keys(DEFAULTS);

let _cached: Record<string, string> | null = null;

/**
 * Fetch all application URLs from app_settings.
 * Results are cached for the lifetime of the edge function invocation.
 */
export async function getAppUrls(): Promise<Record<string, string>> {
  if (_cached) return _cached;

  const result = { ...DEFAULTS };

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return result;

    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", URL_KEYS);

    if (data) {
      for (const s of data) {
        if (s.setting_value) {
          result[s.setting_key] = s.setting_value;
        }
      }
    }

    _cached = result;
    return result;
  } catch (error) {
    console.warn("Error fetching app URLs:", error);
    return result;
  }
}
