import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/**
 * Editable app_setting: fetches the current value via React Query and
 * exposes a save() that upserts then invalidates the query. Throws on
 * save error so the caller can toast the message.
 */
export function useEditableAppSetting(key: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["app_setting", key],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", key)
        .maybeSingle();
      const raw = data?.setting_value as unknown;
      if (typeof raw === "string" && raw.trim().length > 0) return raw;
      return "";
    },
  });

  const save = async (value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { setting_key: key, setting_value: value as any, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" },
      );
    if (error) throw new Error(error.message);
    qc.invalidateQueries({ queryKey: ["app_setting", key] });
  };

  return { data, isLoading, save };
}
