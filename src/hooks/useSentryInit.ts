import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { configureSentry } from "@/lib/sentry";

/**
 * Loads the `sentry_dsn` app setting (Paramètres › Général) and initializes
 * Sentry at runtime. Re-runs on sign-in so the DSN is picked up even on a fresh
 * browser with no cached value. The app_settings row is only readable by
 * authenticated users (RLS), which is fine — a DSN is public anyway, and staff
 * usage is behind auth.
 */
export function useSentryInit(): void {
  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "sentry_dsn")
        .maybeSingle();
      let dsn = data?.setting_value as string | undefined;
      // Learner accounts have no read access to app_settings (staff-only RLS):
      // without this fallback, Sentry stays disabled for the whole learner
      // portal and its errors are never reported.
      if (!dsn) {
        const { data: publicDsn } = await supabase.rpc("get_app_setting_public", {
          p_key: "sentry_dsn",
        });
        dsn = (publicDsn as string | null) ?? undefined;
      }
      if (active) configureSentry(dsn);
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") load();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
}
