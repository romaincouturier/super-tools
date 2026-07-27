import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

const SETTING_KEY = "agent_business_context";

export function useAgentBusinessContext() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      if (error) {
        toast.error("Impossible de charger le contexte métier", { description: error.message });
      } else {
        setValue(data?.setting_value || "");
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = useCallback(async (newValue: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { setting_key: SETTING_KEY, setting_value: newValue, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" },
      );
    setSaving(false);
    if (error) {
      toast.error("Impossible d'enregistrer le contexte métier", { cause: error });
      return false;
    }
    toast.success("Contexte métier enregistré");
    return true;
  }, []);

  return { value, setValue, loading, saving, save };
}
