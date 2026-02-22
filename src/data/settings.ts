import { settingsRepository } from "@/infrastructure/supabase/settings.repository";

// Re-export domain types for backward compatibility
export type { SettingsMap } from "@/domain/repositories/settings.repository";

// --- Settings CRUD (delegated to repository) ---

export const fetchAllSettings = () => settingsRepository.fetchAll();

export const saveSettings = (
  settings: Array<{ setting_key: string; setting_value: string; description?: string }>,
) => settingsRepository.save(settings);

export const uploadReglementInterieur = (file: File) =>
  settingsRepository.uploadReglementInterieur(file);
