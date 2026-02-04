/**
 * Signitic Email Signature Module
 *
 * Fetches the HTML email signature from Signitic API
 * Falls back to a default signature if API is unavailable
 */

const SIGNITIC_EMAIL = "romain@supertilt.fr";
const SIGNITIC_API_URL = `https://api.signitic.app/signatures/${SIGNITIC_EMAIL}/html`;

/**
 * Default signature HTML when Signitic API is unavailable
 */
function getDefaultSignature(): string {
  return `
    <p style="margin-top: 20px;">--</p>
    <p style="font-size: 14px; color: #333;">
      <strong>Romain Couturier</strong><br>
      Expert en agilité et gestion du temps, facilitateur graphique et facilitateur d'intelligence collective<br>
      06 66 98 76 35<br>
      <a href="https://www.supertilt.fr" style="color: #0066cc;">www.supertilt.fr</a>
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
    const response = await fetch(SIGNITIC_API_URL, {
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
