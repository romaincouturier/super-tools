import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DemoModeContextValue {
  isDemoMode: boolean;
  toggleDemoMode: () => Promise<void>;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  isDemoMode: false,
  toggleDemoMode: async () => {},
});

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, demo_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfileId(data.id);
        setIsDemoMode(data.demo_mode ?? false);
      }
    });
  }, []);

  const toggleDemoMode = useCallback(async () => {
    const next = !isDemoMode;
    setIsDemoMode(next);
    if (profileId) {
      await (supabase as any)
        .from("profiles")
        .update({ demo_mode: next, updated_at: new Date().toISOString() })
        .eq("id", profileId);
    }
  }, [isDemoMode, profileId]);

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
