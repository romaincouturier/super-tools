import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { SETTINGS_REGISTRY, SETTINGS_DEFAULTS } from "@/components/settings/settingsConstants";

export function useSettingsManager() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>(SETTINGS_DEFAULTS);
  const [hasGoogleDrive, setHasGoogleDrive] = useState(false);

  const initialLoadDoneRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const navigate = useNavigate();

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchSettings();
      const { count } = await supabase.from("google_drive_tokens").select("*", { count: "exact", head: true });
      setHasGoogleDrive((count ?? 0) > 0);
      setLoading(false);
      initialLoadDoneRef.current = true;
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", Object.keys(SETTINGS_REGISTRY));

    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }

    const loaded: Record<string, string> = {};
    data?.forEach((s) => {
      loaded[s.setting_key] = s.setting_value || SETTINGS_REGISTRY[s.setting_key]?.default || "";
    });
    setSettings(prev => ({ ...prev, ...loaded }));
  };

  const autoSaveSettings = useCallback(async () => {
    setAutoSaveStatus("saving");
    try {
      const settingsToSave = Object.entries(SETTINGS_REGISTRY).map(([key, { description }]) => ({
        setting_key: key,
        setting_value: settings[key] || "",
        description,
      }));

      await Promise.all(
        settingsToSave.map(setting =>
          supabase.from("app_settings").upsert(setting, { onConflict: "setting_key" })
        )
      );

      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch (error: unknown) {
      console.error("Auto-save settings error:", error);
      setAutoSaveStatus("idle");
    }
  }, [settings]);

  useEffect(() => {
    if (!initialLoadDoneRef.current || loading) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setAutoSaveStatus("idle");
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveSettings();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveSettings, loading]);

  return {
    user,
    loading,
    settings,
    updateSetting,
    hasGoogleDrive,
    autoSaveStatus,
    initialLoadDone: initialLoadDoneRef.current,
  };
}
