/**
 * Shared Supabase helpers — eliminates duplicated patterns across service files.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Bypass the generated Database type that doesn't cover all tables.
 * Every service used to define its own `db()` — now centralized here.
 */
export const db = () =>
  supabase as unknown as {
    from: (table: string) => any;
  };

/**
 * Unwrap a Supabase result, throwing on error.
 */
export function throwIfError<T>(result: {
  data: T;
  error: { message: string } | null;
}): T {
  if (result.error) throw result.error;
  return result.data;
}

/**
 * Get the max `position` value in a table, optionally filtered.
 * Returns -1 if no rows match (so `maxPosition + 1` starts at 0).
 */
export async function getMaxPosition(
  table: string,
  filters?: Record<string, unknown>,
): Promise<number> {
  let query = db().from(table).select("position");
  if (filters) {
    for (const [col, val] of Object.entries(filters)) {
      query = query.eq(col, val);
    }
  }
  const { data } = await query.order("position", { ascending: false }).limit(1);
  return (data as { position: number }[] | null)?.[0]?.position ?? -1;
}

/** Vrai si une session authentifiée est ouverte côté client. */
export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/**
 * Profils publics de l'équipe. La fonction est réservée aux comptes
 * authentifiés : sans session on renvoie une liste vide plutôt que de
 * provoquer un "permission denied" à chaque chargement.
 */
export async function fetchStaffPublicProfiles(): Promise<
  { email: string; first_name?: string | null; last_name?: string | null; photo_url?: string | null }[]
> {
  if (!(await hasSession())) return [];
  const { data, error } = await supabase.rpc("get_staff_public_profiles");
  if (error) return [];
  return (data as { email: string }[] | null) ?? [] as any;
}
