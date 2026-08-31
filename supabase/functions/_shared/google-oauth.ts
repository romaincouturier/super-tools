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

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Google access token: ${await response.text()}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    // Google répond parfois 200 avec un corps d'erreur : sans ce contrôle, on
    // repart avec un token undefined et l'échec surgit plus loin, sans cause.
    throw new Error(`Failed to refresh Google access token: ${JSON.stringify(data)}`);
  }

  const expiresInSeconds = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token as string,
    expiresInSeconds,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}
