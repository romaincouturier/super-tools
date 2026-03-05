import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch a single app_setting value by key.
 * Returns the setting value or the provided default while loading.
 */
export function useAppSetting(key: string, defaultValue: string): string {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", key)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.setting_value) {
          setValue(data.setting_value);
        }
      });
  }, [key]);

  return value;
}
