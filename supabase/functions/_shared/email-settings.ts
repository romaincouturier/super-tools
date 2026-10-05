/**
 * Email Settings Module
 *
 * Centralized email settings fetched from app_settings table.
 * Replaces all hardcoded romain@supertilt.fr references.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface EmailSettings {
  senderEmail: string;
  senderName: string;
  bccEnabled: boolean;
  contactEmail: string;
  nocrmBccEmail: string;
}

let _cached: EmailSettings | null = null;

/**
 * Fetch email settings from app_settings.
 * Results are cached for the lifetime of the edge function invocation.
 */
async function fetchSettings(): Promise<EmailSettings> {
  if (_cached) return _cached;

  const defaults: EmailSettings = {
    senderEmail: "romain@supertilt.fr",
    senderName: "Romain Couturier",
    bccEnabled: true,
    contactEmail: "contact@supertilt.fr",
    nocrmBccEmail: "supertilt@bcc.nocrm.io",
  };

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return defaults;

    const supabase = createClient(url, key);
    const { data } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcc_email", "bcc_enabled", "sender_email", "sender_name", "contact_email", "nocrm_bcc_email"]);

    if (data) {
      // Strip ALL whitespace from email values — a stray space breaks Resend's `from` validation
      const cleanEmail = (v: string) => v.replace(/\s+/g, "");
      const cleanName = (v: string) => v.trim();
      for (const s of data) {
        if (s.setting_key === "bcc_email" && s.setting_value) defaults.senderEmail = cleanEmail(s.setting_value);
        if (s.setting_key === "sender_email" && s.setting_value) defaults.senderEmail = cleanEmail(s.setting_value);
        if (s.setting_key === "sender_name" && s.setting_value) defaults.senderName = cleanName(s.setting_value);
        if (s.setting_key === "contact_email" && s.setting_value) defaults.contactEmail = cleanEmail(s.setting_value);
        if (s.setting_key === "bcc_enabled") defaults.bccEnabled = s.setting_value === "true";
        if (s.setting_key === "nocrm_bcc_email" && s.setting_value) defaults.nocrmBccEmail = cleanEmail(s.setting_value);
      }
    }

    _cached = defaults;
    return defaults;
  } catch (error) {
    console.warn("Error fetching email settings:", error);
    return defaults;
  }
}

/**
 * Get the "From" header value: "Name <email>"
 */
export async function getSenderFrom(): Promise<string> {
  const s = await fetchSettings();
  return `${s.senderName} <${s.senderEmail}>`;
}

/**
 * Get the sender email address only
 */
export async function getSenderEmail(): Promise<string> {
  const s = await fetchSettings();
  return s.senderEmail;
}

/**
 * Get the sender display name
 */
export async function getSenderName(): Promise<string> {
  const s = await fetchSettings();
  return s.senderName;
}

/**
 * Get the BCC email list (sender email + NoCRM)
 */
export async function getBccList(): Promise<string[]> {
  const s = await fetchSettings();
  const list: string[] = [];
  if (s.bccEnabled && s.senderEmail) {
    list.push(s.senderEmail);
  }
  if (s.nocrmBccEmail) list.push(s.nocrmBccEmail);
  return list;
}

/**
 * Get the Signitic signature URL for the sender
 */
export async function getSigniticUrl(): Promise<string> {
  const s = await fetchSettings();
  return `https://api.signitic.app/signatures/${s.senderEmail}/html`;
}

/**
 * Adresse de contact affichée aux apprenants et clients (Paramètres > Général).
 */
export async function getContactEmail(): Promise<string> {
  const s = await fetchSettings();
  return s.contactEmail;
}
