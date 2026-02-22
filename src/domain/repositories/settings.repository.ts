import type { SettingKey } from "@/lib/constants";

export type SettingsMap = Partial<Record<SettingKey, string>>;

export interface ISettingsRepository {
  fetchAll(): Promise<SettingsMap>;
  save(
    settings: Array<{ setting_key: string; setting_value: string; description?: string }>,
  ): Promise<void>;
  uploadReglementInterieur(file: File): Promise<string>;
}
