import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useFeatureTracking } from "@/hooks/useFeatureTracking";

/**
 * Tracks page views by listening to route changes.
 * Place inside <BrowserRouter> to automatically log each navigation.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackFeature } = useFeatureTracking();

  useEffect(() => {
    // Strip dynamic IDs from path for cleaner aggregation
    const cleanPath = location.pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "/:id")
      .replace(/\/\d+/g, "/:id");

    trackFeature("page_view", "navigation", { path: cleanPath, raw_path: location.pathname });
  }, [location.pathname, trackFeature]);

  return null;
}
