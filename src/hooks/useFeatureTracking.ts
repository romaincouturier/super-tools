/**
 * Hook for tracking feature usage from React components.
 *
 * Returns a stable `trackFeature` callback that automatically
 * attaches the current user's ID to each event.
 *
 * Usage:
 *   const { trackFeature } = useFeatureTracking();
 *   <Button onClick={() => { trackFeature("delete_training", "formations"); doDelete(); }}>
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackFeatureUsage } from "@/services/featureTracking";

export function useFeatureTracking() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setUserId(user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
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

