import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceSettingsState {
  brandVoice: string;
  userVoice: string;
  loading: boolean;
  saving: boolean;
  userId: string | null;
}

export function useVoiceSettings() {
  const [state, setState] = useState<VoiceSettingsState>({
    brandVoice: "",
    userVoice: "",
    loading: true,
    saving: false,
    userId: null,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [brandResult, profileResult] = await Promise.all([
          supabase
            .from("ai_brand_settings")
            .select("content")
            .eq("setting_type", "supertilt_voice")
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("voice_description")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        setState((prev) => ({
          ...prev,
          userId: user.id,
          brandVoice: brandResult.data?.content || "",
          userVoice: profileResult.data?.voice_description || "",
        }));
      } catch (error) {
        console.error("Error loading voice settings:", error);
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    loadData();
  }, []);

  const setBrandVoice = (v: string) => setState((prev) => ({ ...prev, brandVoice: v }));
  const setUserVoice = (v: string) => setState((prev) => ({ ...prev, userVoice: v }));

  const save = async () => {
    if (!state.userId) return;
    setState((prev) => ({ ...prev, saving: true }));

    try {
      const { error: brandError } = await supabase
        .from("ai_brand_settings")
        .update({ content: state.brandVoice })
        .eq("setting_type", "supertilt_voice");
      if (brandError) throw brandError;

      const { error: userError } = await supabase
        .from("profiles")
        .update({ voice_description: state.userVoice })
        .eq("user_id", state.userId);
      if (userError) throw userError;

      return { success: true as const };
    } catch (error) {
      return { success: false as const, error };
    } finally {
      setState((prev) => ({ ...prev, saving: false }));
    }
  };

  return {
    brandVoice: state.brandVoice,
    userVoice: state.userVoice,
    loading: state.loading,
    saving: state.saving,
    setBrandVoice,
    setUserVoice,
    save,
  };
}
