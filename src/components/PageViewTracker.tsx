import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useFeatureTracking } from "@/hooks/useFeatureTracking";

// Detect crawlers/bots to avoid polluting analytics with non-human traffic.
const BOT_REGEX = /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora link preview|outbrain|pinterest|skype|telegrambot|whatsapp|discordbot|googlebot|gpt|claude|anthropic|perplexity|ccbot|bytespider|ahrefs|semrush|mj12|dotbot|petalbot|dataforseo|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|chrome-lighthouse|screenshot/i;

const isBot = (): boolean => {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (!ua) return true;
  if (BOT_REGEX.test(ua)) return true;
  // navigator.webdriver === true => automation/headless
  if ((navigator as unknown as { webdriver?: boolean }).webdriver) return true;
  return false;
};

/**
 * Tracks page views by listening to route changes.
 * Skips bots, crawlers and headless browsers to keep stats clean.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { trackFeature } = useFeatureTracking();

  useEffect(() => {
    if (isBot()) return;

    // Strip dynamic IDs from path for cleaner aggregation
    const cleanPath = location.pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "/:id")
      .replace(/\/\d+/g, "/:id");

    trackFeature("page_view", "navigation", { path: cleanPath, raw_path: location.pathname });
  }, [location.pathname, trackFeature]);

  return null;
}
