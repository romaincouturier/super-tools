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
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return null;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for auth verification");
    return null;
  }

  try {
    // Verify token via Auth REST API directly (avoids supabase-js getUser quirks in Deno edge runtime)
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceKey,
      },
    });

    if (!response.ok) {
      console.warn("Auth verification failed:", response.status);
      return null;
    }

    const user = await response.json();
    if (!user?.id) {
      console.warn("Auth verification failed: no user id in response");
      return null;
    }

    return { id: user.id, email: user.email };
  } catch (error) {
    console.error("Error verifying auth:", error);
    return null;
  }
}
