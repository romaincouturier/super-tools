import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { refreshGoogleAccessToken } from "./google-oauth.ts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Deno.env n'existe pas sous vitest : on le simule le temps du test. */
function stubEnv(values: Record<string, string | undefined>) {
  vi.stubGlobal("Deno", { env: { get: (key: string) => values[key] } });
}

function stubFetch(response: Response) {
  const impl = vi.fn(async () => response);
  vi.stubGlobal("fetch", impl);
  return impl;
}

beforeEach(() => {
  stubEnv({ GOOGLE_OAUTH_CLIENT_ID: "client-id", GOOGLE_OAUTH_CLIENT_SECRET: "client-secret" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("refreshGoogleAccessToken", () => {
  it("échange le refresh token contre un access token", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ access_token: "ya29.new", expires_in: 3599 }), { status: 200 }),
    );

    const result = await refreshGoogleAccessToken("1//refresh");

    expect(result.accessToken).toBe("ya29.new");
    expect(result.expiresInSeconds).toBe(3599);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TOKEN_URL);
    expect(String(init.body)).toBe(
      "client_id=client-id&client_secret=client-secret&refresh_token=1%2F%2Frefresh&grant_type=refresh_token",
    );
  });

  it("calcule la date d'expiration à partir de expires_in", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T10:00:00.000Z"));
    stubFetch(
      new Response(JSON.stringify({ access_token: "ya29.new", expires_in: 3600 }), { status: 200 }),
    );

    const result = await refreshGoogleAccessToken("1//refresh");

    expect(result.expiresAt).toBe("2026-08-31T11:00:00.000Z");
  });

  it("retombe sur une heure quand Google n'annonce pas de durée", async () => {
    stubFetch(new Response(JSON.stringify({ access_token: "ya29.new" }), { status: 200 }));

    const result = await refreshGoogleAccessToken("1//refresh");

    expect(result.expiresInSeconds).toBe(3600);
  });

  it("échoue si les identifiants OAuth ne sont pas configurés", async () => {
    stubEnv({});
    const fetchMock = stubFetch(new Response("", { status: 200 }));

    await expect(refreshGoogleAccessToken("1//refresh")).rejects.toThrow(
      /credentials not configured/,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("échoue si le secret OAuth est absent", async () => {
    stubEnv({ GOOGLE_OAUTH_CLIENT_ID: "client-id" });
    stubFetch(new Response("", { status: 200 }));

    await expect(refreshGoogleAccessToken("1//refresh")).rejects.toThrow(
      /credentials not configured/,
    );
  });

  it("remonte le corps de la réponse quand Google refuse l'échange", async () => {
    stubFetch(new Response("invalid_grant", { status: 400 }));

    await expect(refreshGoogleAccessToken("1//revoked")).rejects.toThrow(/invalid_grant/);
  });

  it("échoue quand Google répond 200 sans access token", async () => {
    // Cas réel : réponse 200 portant une erreur, qui donnerait sinon un token
    // undefined et un échec plus loin, sans cause identifiable.
    stubFetch(new Response(JSON.stringify({ error: "invalid_client" }), { status: 200 }));

    await expect(refreshGoogleAccessToken("1//refresh")).rejects.toThrow(/invalid_client/);
  });
});
