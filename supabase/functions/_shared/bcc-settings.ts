/**
 * BCC Settings Module
 *
 * Re-exports from email-settings for backwards compatibility.
 */

export { getBccList } from "./email-settings.ts";

/**
 * Get BCC email list from app settings
 *
 * @param _supabase - Supabase client (kept for API compat, no longer used)
 * @returns Promise<string[]> - Array of BCC email addresses
 */
// deno-lint-ignore no-explicit-any
export async function getBccSettings(_supabase?: any): Promise<string[]> {
  const { getBccList: _getBccList } = await import("./email-settings.ts");
  return _getBccList();
}
