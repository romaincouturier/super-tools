/**
 * Reusable hook for tracking user journey events on public pages.
 *
 * Stores events in a ref (no re-renders) and provides helpers
 * for common events like page load, consent, and signature drawing.
 */
import { useCallback, useRef } from "react";

export interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export function useJourneyTracking() {
  const eventsRef = useRef<JourneyEvent[]>([]);

  const trackEvent = useCallback((event: string, details?: Record<string, unknown>) => {
    eventsRef.current.push({
      event,
      timestamp: new Date().toISOString(),
      details,
    });
  }, []);

  /** Standard "page_loaded" event with device info */
  const trackPageLoaded = useCallback(() => {
    trackEvent("page_loaded", {
      user_agent: navigator.userAgent,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    });
  }, [trackEvent]);

  /** Get the device info object for submission payloads */
  const getDeviceInfo = useCallback(() => ({
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
    cookiesEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
  }), []);

  return {
    /** Ref containing all tracked events — pass to submission payloads */
    journeyEvents: eventsRef,
    /** Track a single event */
    trackEvent,
    /** Track standard page_loaded event with device info */
    trackPageLoaded,
    /** Get device info object for submission */
    getDeviceInfo,
  };
}
