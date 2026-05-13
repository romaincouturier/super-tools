import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Scopes needed for Google Drive uploads and polling existing folders/files.
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");
const REQUIRED_SCOPES = SCOPES.split(" ");

function redirectToClientCallback(
  appCallbackUrl: string | undefined,
  params: Record<string, string>,
): Response {
  if (!appCallbackUrl) {
    return new Response("Authentification Google Drive terminée. Vous pouvez fermer cette fenêtre.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const callbackUrl = new URL(appCallbackUrl);
  for (const [key, value] of Object.entries(params)) {
    callbackUrl.searchParams.set(key, value);
  }

  return Response.redirect(callbackUrl.toString(), 303);
}

async function getGrantedScopes(accessToken: string): Promise<string[]> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return String(data.scope ?? "").split(" ").filter(Boolean);
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Google Drive Auth - Action: ${action}`);

    // Action: initiate OAuth flow
    if (action === "initiate") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !userData.user) {
        console.error("Auth error:", userError);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get redirect URI from request body
      const body = await req.json().catch(() => ({}));
      const redirectUri = body.redirectUri || `${SUPABASE_URL}/functions/v1/google-drive-auth?action=callback`;
      const appCallbackUrl = body.appCallbackUrl;

      // Create state with user ID for callback
      const state = btoa(JSON.stringify({ userId: userData.user.id, redirectUri, appCallbackUrl }));

      // Build Google OAuth URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      console.log(`Generated OAuth URL for user ${userData.user.id}`);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: handle OAuth callback
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        console.error("OAuth error:", error);
        let appCallbackUrl: string | undefined;
        if (state) {
          try {
            appCallbackUrl = JSON.parse(atob(state)).appCallbackUrl;
          } catch {
            // Ignore malformed state and return a plain error below.
          }
        }
        return redirectToClientCallback(appCallbackUrl, { success: "false", error });
      }

      if (!code || !state) {
        return redirectToClientCallback(undefined, { success: "false", error: "Missing code or state" });
      }

      // Decode state
      let stateData: { userId: string; redirectUri: string; appCallbackUrl?: string };
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        return redirectToClientCallback(undefined, { success: "false", error: "Invalid state" });
      }

      console.log(`Callback received for user ${stateData.userId}`);

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_OAUTH_CLIENT_ID,
          client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: stateData.redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      console.log("Token exchange response status:", tokenResponse.status);

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error("Token exchange failed:", tokenData);
        return redirectToClientCallback(stateData.appCallbackUrl, { success: "false", error: "Token exchange failed" });
      }

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      // Store tokens in database using service role
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: upsertError } = await supabase
        .from("google_drive_tokens")
        .upsert({
          user_id: stateData.userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
        }, {
          onConflict: "user_id",
        });

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        return redirectToClientCallback(stateData.appCallbackUrl, { success: "false", error: "Failed to store tokens" });
      }

      console.log(`Tokens stored successfully for user ${stateData.userId}`);

      // Success - redirect to the frontend callback route so browser scripts are executed by the app origin.
      return redirectToClientCallback(stateData.appCallbackUrl, { success: "true" });
    }

    // Action: check connection status
    if (action === "status") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ connected: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        return new Response(JSON.stringify({ connected: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tokenData } = await supabase
        .from("google_drive_tokens")
        .select("id, access_token, token_expires_at")
        .eq("user_id", userData.user.id)
        .single();

      const grantedScopes = tokenData?.access_token
        ? await getGrantedScopes(tokenData.access_token)
        : [];
      const missingScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope));

      return new Response(JSON.stringify({ 
        connected: !!tokenData && missingScopes.length === 0,
        needsReconnect: !!tokenData && missingScopes.length > 0,
        missingScopes,
        expiresAt: tokenData?.token_expires_at 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: disconnect
    if (action === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("google_drive_tokens")
        .delete()
        .eq("user_id", userData.user.id);

      console.log(`Tokens deleted for user ${userData.user.id}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in google-drive-auth:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
