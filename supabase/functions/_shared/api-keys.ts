/**
 * Read API keys from app_settings table instead of environment variables.
 * Keys are configured by the user in Paramètres → Intégrations.
 */

import { getSupabaseClient } from "./supabase-client.ts";

let cachedKeys: Record<string, string> = {};
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getAppSetting(key: string): Promise<string | null> {
  const now = Date.now();
  if (cachedKeys[key] && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedKeys[key];
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();

  const value = data?.setting_value || null;
  if (value) {
    cachedKeys[key] = value;
    cacheTimestamp = now;
  }
  return value;
}

/**
 * Get OpenAI API key — first from app_settings, fallback to env var.
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  const fromSettings = await getAppSetting("openai_api_key");
  if (fromSettings) return fromSettings;
  // Fallback to env var for backward compatibility
  return Deno.env.get("OPENAI_API_KEY") || null;
}
