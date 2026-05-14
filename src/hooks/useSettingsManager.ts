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
  const settingsRef = useRef<Record<string, string>>(SETTINGS_DEFAULTS);
  const loadedHashRef = useRef<string>("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const navigate = useNavigate();

  // Keep a ref always in sync with state so unmount flush can read latest values
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

    // Flush pending save on unmount so navigating away doesn't lose changes
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        const currentHash = JSON.stringify(settingsRef.current);
        if (currentHash !== loadedHashRef.current && loadedHashRef.current !== "") {
          performSave(settingsRef.current);
        }
      }
    };
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", Object.keys(SETTINGS_REGISTRY));

    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }

    const loaded: Record<string, string> = { ...SETTINGS_DEFAULTS };
    data?.forEach((s) => {
      loaded[s.setting_key] = s.setting_value || SETTINGS_REGISTRY[s.setting_key]?.default || "";
    });
    setSettings(loaded);
    settingsRef.current = loaded;
    loadedHashRef.current = JSON.stringify(loaded);
  };

  const performSave = async (currentSettings: Record<string, string>) => {
    setAutoSaveStatus("saving");
    try {
      const settingsToSave = Object.entries(SETTINGS_REGISTRY).map(([key, { description }]) => ({
        setting_key: key,
        setting_value: currentSettings[key] ?? "",
        description,
      }));

      await Promise.all(
        settingsToSave.map(setting =>
          supabase.from("app_settings").upsert(setting, { onConflict: "setting_key" })
        )
      );

      loadedHashRef.current = JSON.stringify(currentSettings);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch (error: unknown) {
      console.error("Auto-save settings error:", error);
      setAutoSaveStatus("idle");
    }
  };

  const autoSaveSettings = useCallback(async () => {
    await performSave(settingsRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialLoadDoneRef.current || loading) return;

    // Skip save if nothing changed since last save
    const currentHash = JSON.stringify(settings);
    if (currentHash === loadedHashRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveSettings();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [settings, loading, autoSaveSettings]);

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
