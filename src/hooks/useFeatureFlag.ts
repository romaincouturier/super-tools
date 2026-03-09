import { useAppSetting } from "./useAppSetting";

/**
 * Check if a feature flag is enabled.
 * Reads from app_settings table, returns false by default.
 */
export function useFeatureFlag(flag: string): boolean {
  const value = useAppSetting(flag, "false");
  return value === "true";
}
