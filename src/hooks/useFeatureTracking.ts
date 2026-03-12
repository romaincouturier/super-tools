/**
 * Hook for tracking feature usage from React components.
 *
 * Returns a stable `trackFeature` callback that automatically
 * attaches the current user's ID to each event.
 *
 * Uses direct Supabase auth to avoid useAuth/useNavigate,
 * which would force redirects on public pages and can cause
 * dual-React-instance errors.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackFeatureUsage } from "@/services/featureTracking";

export function useFeatureTracking() {
  const [userId, setUserId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mountedRef.current) setUserId(data.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mountedRef.current) setUserId(session?.user?.id ?? null);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const trackFeature = useCallback(
    (featureName: string, featureCategory: string, metadata?: Record<string, unknown>) => {
      if (!userId) return;
      trackFeatureUsage(userId, featureName, featureCategory, metadata);
    },
    [userId],
  );

  return { trackFeature };
}

