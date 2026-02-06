/**
 * Supabase Client Module
 *
 * Provides a centralized way to create Supabase clients
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedClient: SupabaseClient | null = null;

/**
 * Get or create a Supabase client with service role key
 *
 * Uses caching to avoid creating multiple clients
 *
 * @returns SupabaseClient
 * @throws Error if environment variables are not set
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceKey);
  return cachedClient;
}

/**
 * Create a new Supabase client (non-cached)
 *
 * Use this when you need a fresh client instance
 *
 * @returns SupabaseClient
 * @throws Error if environment variables are not set
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Verify JWT token and get user
 *
 * @param authHeader - Authorization header value
 * @returns User object or null
 */
export async function verifyAuth(authHeader: string | null): Promise<{ id: string; email?: string } | null> {
  console.log("verifyAuth called, authHeader present:", !!authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("verifyAuth: missing or malformed auth header");
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    console.warn("verifyAuth: empty token");
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  console.log("verifyAuth env check - URL:", !!supabaseUrl, "ANON_KEY:", !!anonKey);

  if (!supabaseUrl || !anonKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY for auth verification");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user?.id) {
      console.warn("verifyAuth failed:", error?.message || "no user in response");
      return null;
    }

    console.log("verifyAuth success, user:", user.id);
    return { id: user.id, email: user.email };
  } catch (error) {
    console.error("verifyAuth exception:", error);
    return null;
  }
}
