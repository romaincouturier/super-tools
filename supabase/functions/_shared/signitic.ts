/**
 * Signitic Email Signature Module
 *
 * Fetches the HTML email signature from Signitic API
 * Falls back to a default signature if API is unavailable
 */

import { getSigniticUrl, getSenderName, getSenderEmail } from "./email-settings.ts";
import { getAppUrls } from "./app-urls.ts";

/**
 * Default signature HTML when Signitic API is unavailable
 */
async function getDefaultSignature(): Promise<string> {
  const name = await getSenderName();
  const email = await getSenderEmail();
  const urls = await getAppUrls();
  const websiteUrl = urls.website_url;
  return `
    <p style="margin-top: 20px;">--</p>
    <p style="font-size: 14px; color: #333;">
      <strong>${name}</strong><br>
      <a href="mailto:${email}" style="color: #0066cc;">${email}</a><br>
      <a href="${websiteUrl}" style="color: #0066cc;">${websiteUrl.replace(/^https?:\/\//, "")}</a>
    </p>
  `;
}

/**
 * Fetch the Signitic signature HTML
 *
 * @returns Promise<string> - HTML signature content
 */
export async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");

  if (!signiticApiKey) {
    console.warn("SIGNITIC_API_KEY not configured, using default signature");
    return getDefaultSignature();
  }

  try {
    const apiUrl = await getSigniticUrl();
    const response = await fetch(apiUrl, {
      headers: {
        "x-api-key": signiticApiKey,
      },
    });

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && htmlContent.trim() && !htmlContent.includes("error")) {
        console.log("Signitic signature fetched successfully");
        return htmlContent;
      }
    }

    console.warn("Could not fetch Signitic signature:", response.status);
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}
