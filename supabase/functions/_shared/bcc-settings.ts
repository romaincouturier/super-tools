/**
 * BCC Settings Module
 *
 * Fetches BCC email settings from app_settings table
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const NOCRM_BCC = "supertilt@bcc.nocrm.io";

interface BccSetting {
  setting_key: string;
  setting_value: string | null;
}

/**
 * Get BCC email list from app settings
 *
 * @param supabase - Supabase client instance
 * @returns Promise<string[]> - Array of BCC email addresses
 */
export async function getBccSettings(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data: bccSettings } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["bcc_email", "bcc_enabled"]);

    let bccEnabled = true;
    let bccEmailValue: string | null = null;

    bccSettings?.forEach((s: BccSetting) => {
      if (s.setting_key === "bcc_enabled") {
        bccEnabled = s.setting_value === "true";
      }
      if (s.setting_key === "bcc_email" && s.setting_value) {
        bccEmailValue = s.setting_value;
      }
    });

    const bccList: string[] = [];

    if (bccEnabled && bccEmailValue) {
      bccList.push(bccEmailValue);
    }

    // Always add NoCRM BCC
    bccList.push(NOCRM_BCC);

    console.log(
      "BCC settings - enabled:",
      bccEnabled,
      "email:",
      bccEmailValue,
      "final list:",
      bccList.join(", ")
    );

    return bccList;
  } catch (error) {
    console.warn("Error fetching BCC settings, using default:", error);
    return [NOCRM_BCC];
  }
}
