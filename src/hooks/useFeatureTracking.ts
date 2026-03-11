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
import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trackFeatureUsage } from "@/services/featureTracking";

export function useFeatureTracking() {
  const { user } = useAuth();

  const trackFeature = useCallback(
    (featureName: string, featureCategory: string, metadata?: Record<string, unknown>) => {
      if (!user?.id) return;
      trackFeatureUsage(user.id, featureName, featureCategory, metadata);
    },
    [user?.id],
  );

  return { trackFeature };
}
