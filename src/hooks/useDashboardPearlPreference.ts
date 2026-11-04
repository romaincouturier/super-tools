import { useUserPreference } from "@/hooks/useUserPreferences";

export const DASHBOARD_PEARL_PREF_KEY = "dashboard_pearl";

export function useDashboardPearlPreference() {
  const pref = useUserPreference<{ enabled: boolean }>(DASHBOARD_PEARL_PREF_KEY, { enabled: false });
  return {
    enabled: pref.value?.enabled === true,
    loading: pref.loading,
    setEnabled: (enabled: boolean) => pref.save({ enabled }),
  };
}
