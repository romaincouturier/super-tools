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
  const websiteDisplay = websiteUrl.replace(/^https?:\/\//, "");
  return `
    <table cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; margin-top: 24px; border-collapse: collapse;">
      <tr>
        <td style="border-left: 3px solid #e6bc00; padding-left: 14px;">
          <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 700; color: #1a1a1a;">${name}</p>
          <p style="margin: 0 0 2px 0; font-size: 13px; color: #555;">Facilitateur &amp; Formateur</p>
          <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #e6bc00;">SuperTilt</p>
          <p style="margin: 0; font-size: 12px; color: #888;">
            <a href="mailto:${email}" style="color: #555; text-decoration: none;">${email}</a>
            &nbsp;·&nbsp;
            <a href="${websiteUrl}" style="color: #555; text-decoration: none;">${websiteDisplay}</a>
          </p>
        </td>
      </tr>
    </table>
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
      const lower = htmlContent.toLowerCase();
      const isValid = htmlContent && htmlContent.trim().length > 50
        && !lower.includes("error")
        && !lower.includes("time-out")
        && !lower.includes("timeout")
        && !lower.includes("gateway")
        && !lower.includes("not found")
        && !lower.includes("502")
        && !lower.includes("503")
        && !lower.includes("504")
        && lower.includes("<") && lower.includes(">");
      if (isValid) {
        console.log("Signitic signature fetched successfully");
        return htmlContent;
      }
      console.warn("Signitic response looks invalid, using default signature");
    }

    console.warn("Could not fetch Signitic signature:", response.status);
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}
