import { supabase } from "@/integrations/supabase/client";
import type { ApiKeys } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token || ""}`,
  };
}

/**
 * Call the arena-orchestrate Edge Function (streaming SSE).
 * Returns a Response with a readable stream.
 */
export async function callOrchestrate(body: {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  turnInstruction: string;
  history: { agentName: string; content: string; isUser?: boolean }[];
  topic: string;
  maxTokens: number;
}, signal?: AbortSignal): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${SUPABASE_URL}/functions/v1/arena-orchestrate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Call the arena-orchestrator Edge Function (JSON response).
 */
export async function callOrchestratorApi(body: {
  apiKey: string;
  provider?: string;
  topic: string;
  mode: string;
  agents: { id: string; name: string; role: string; personality: string; stance?: string }[];
  history: { agentName: string; content: string; isUser?: boolean }[];
  turnNumber: number;
  maxTurns: number;
  language: string;
}, signal?: AbortSignal): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${SUPABASE_URL}/functions/v1/arena-orchestrator`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Call the arena-suggest-experts Edge Function (JSON response).
 */
export async function callSuggestExperts(body: {
  apiKey: string;
  provider?: string;
  topic: string;
  mode: string;
  language: string;
}): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(`${SUPABASE_URL}/functions/v1/arena-suggest-experts`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ── API Key Management via app_settings ──

const ARENA_KEY_SETTINGS = {
  claude: "arena_claude_api_key",
  openai: "arena_openai_api_key",
  gemini: "arena_gemini_api_key",
} as const;

const LOCAL_STORAGE_KEY = "ai-arena-api-keys";

/**
 * Load arena API keys from app_settings, falling back to localStorage.
 */
export async function loadArenaApiKeys(): Promise<ApiKeys> {
  // Try localStorage first for instant load
  let keys: ApiKeys = {};
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) keys = JSON.parse(cached);
  } catch { /* intentionally empty – localStorage JSON parse may fail */ }

  // Then try Supabase app_settings (overrides localStorage)
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", Object.values(ARENA_KEY_SETTINGS));

    if (data && data.length > 0) {
      for (const row of data) {
        if (row.setting_key === ARENA_KEY_SETTINGS.claude && row.setting_value) keys.claude = row.setting_value;
        if (row.setting_key === ARENA_KEY_SETTINGS.openai && row.setting_value) keys.openai = row.setting_value;
        if (row.setting_key === ARENA_KEY_SETTINGS.gemini && row.setting_value) keys.gemini = row.setting_value;
      }
      // Cache in localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys));
    }
  } catch {
    // If Supabase fails, use localStorage cache
  }

  return keys;
}

/**
 * Save arena API keys to both app_settings and localStorage.
 */
export async function saveArenaApiKeys(keys: ApiKeys): Promise<void> {
  // Save to localStorage immediately
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys));

  // Save to Supabase app_settings
  const settings = [
    { setting_key: ARENA_KEY_SETTINGS.claude, setting_value: keys.claude || "", description: "Cle API Anthropic (Claude) pour AI Arena" },
    { setting_key: ARENA_KEY_SETTINGS.openai, setting_value: keys.openai || "", description: "Cle API OpenAI pour AI Arena" },
    { setting_key: ARENA_KEY_SETTINGS.gemini, setting_value: keys.gemini || "", description: "Cle API Google Gemini pour AI Arena" },
  ];

  for (const setting of settings) {
    await supabase.from("app_settings").upsert(setting, { onConflict: "setting_key" });
  }
}
