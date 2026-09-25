/**
 * Rafraîchissement d'un access token Google, mutualisé.
 *
 * Cinq fonctions en avaient chacune leur copie, avec des messages d'erreur
 * différents et des postures différentes sur le token expiré. Une seule copie
 * ici : un changement côté Google (paramètre, format d'erreur, expiration) se
 * corrige à un seul endroit.
 */

export interface RefreshedGoogleToken {
  accessToken: string;
  /** Durée de validité annoncée par Google, en secondes. */
  expiresInSeconds: number;
  /** Date d'expiration au format ISO, prête à écrire en base. */
  expiresAt: string;
}

/**
 * Échange un refresh token contre un access token.
 *
 * Lève si les identifiants OAuth ne sont pas configurés ou si Google refuse
 * l'échange. Les appelants qui préfèrent une valeur nulle à une exception
 * encapsulent l'appel dans un try/catch.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<RefreshedGoogleToken> {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  // Google renvoie parfois des erreurs transitoires (5xx, 429, "internal_failure",
  // "backend_error") : on réessaie avec backoff 1s, 2s. Les refus définitifs
  // (invalid_grant, invalid_client) ne sont pas réessayés.
  const delays = [1000, 2000];
  let data: Record<string, unknown> = {};
  for (let attempt = 0; ; attempt++) {
    let transient = false;
    let failure = "";
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const text = await response.text();
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(text); } catch { /* corps non JSON */ }
      if (response.ok && parsed.access_token) {
        data = parsed;
        break;
      }
      failure = response.ok ? JSON.stringify(parsed) : text;
      transient = response.status >= 500 || response.status === 429 ||
        /internal_failure|backend_error|temporarily_unavailable/i.test(text);
    } catch (networkErr) {
      failure = networkErr instanceof Error ? networkErr.message : String(networkErr);
      transient = true;
    }
    if (!transient || attempt >= delays.length) {
      throw new Error(`Failed to refresh Google access token: ${failure}`);
    }
    await new Promise((r) => setTimeout(r, delays[attempt]));
  }

  const expiresInSeconds = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token as string,
    expiresInSeconds,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}
