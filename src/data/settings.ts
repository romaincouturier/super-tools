import { supabase } from "@/integrations/supabase/client";
import { SETTING_KEYS, type SettingKey } from "@/lib/constants";

export type SettingsMap = Partial<Record<SettingKey, string>>;

/** Fetch all app settings as a key-value map */
export async function fetchAllSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [...SETTING_KEYS]);

  if (error) throw error;

  const map: SettingsMap = {};
  for (const row of data || []) {
    map[row.setting_key as SettingKey] = row.setting_value ?? "";
  }
  return map;
}

/** Save multiple settings at once via batch upsert */
export async function saveSettings(
  settings: Array<{ setting_key: string; setting_value: string; description?: string }>
): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert(settings, { onConflict: "setting_key" });
  if (error) throw error;
}

/** Upload a file to the training-documents bucket and return its public URL */
export async function uploadReglementInterieur(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const filePath = `reglement-interieur/reglement-interieur-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("training-documents")
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("training-documents")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
