import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
].join(" ");

function redirectToClientCallback(
  appCallbackUrl: string | undefined,
  params: Record<string, string>,
): Response {
  if (!appCallbackUrl) {
    return new Response("Authentification Google Calendar terminée. Vous pouvez fermer cette fenêtre.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const callbackUrl = new URL(appCallbackUrl);
  for (const [key, value] of Object.entries(params)) {
    callbackUrl.searchParams.set(key, value);
  }
  return Response.redirect(callbackUrl.toString(), 303);
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function getGoogleCalendarCreateError(errorText: string): { message: string; reason?: string; status: number } {
  let data: any = null;
  try {
    data = JSON.parse(errorText);
  } catch {
    return { message: "Impossible de créer l'événement Google Calendar.", status: 200 };
  }

  const googleError = data?.error;
  const reason = googleError?.errors?.[0]?.reason || googleError?.details?.[0]?.reason;
  const status = Number(googleError?.code) || 200;
  const message = String(googleError?.message || "");

  if (reason === "accessNotConfigured" || reason === "SERVICE_DISABLED" || message.includes("calendar-json.googleapis.com")) {
    return {
      message: "L'API Google Calendar n'est pas activée sur le projet Google OAuth utilisé. Activez Google Calendar API dans Google Cloud, puis réessayez.",
      reason: "calendar_api_disabled",
      status: 200,
    };
  }

  if (reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || message.includes("insufficient authentication scopes")) {
    return {
      message: "La connexion Google Calendar doit être renouvelée avec les droits d'écriture. Déconnectez puis reconnectez Google Calendar.",
      reason: "insufficient_scope",
      status: 200,
    };
  }

  return { message: message || "Impossible de créer l'événement Google Calendar.", reason, status: status >= 400 ? status : 200 };
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action: initiate OAuth flow
    if (action === "initiate") {
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

      const body = await req.json().catch(() => ({}));
      const redirectUri = body.redirectUri || `${SUPABASE_URL}/functions/v1/google-calendar-events?action=callback`;
      const appCallbackUrl = body.appCallbackUrl;

      const state = btoa(JSON.stringify({ userId: userData.user.id, redirectUri, appCallbackUrl }));

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

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

      let appCallbackUrl: string | undefined;
      try { appCallbackUrl = JSON.parse(atob(state || "")).appCallbackUrl; } catch { /* ignore */ }

      if (error) {
        return redirectToClientCallback(appCallbackUrl, { success: "false", error: String(error) });
      }

      if (!code || !state) {
        return redirectToClientCallback(appCallbackUrl, { success: "false", error: "Missing code or state" });
      }

      let stateData: { userId: string; redirectUri: string; appCallbackUrl?: string };
      try {
        stateData = JSON.parse(atob(state));
        appCallbackUrl = stateData.appCallbackUrl;
      } catch {
        return redirectToClientCallback(undefined, { success: "false", error: "Invalid state" });
      }

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

      if (!tokenResponse.ok || !tokenData.access_token) {
        return new Response(
          `<html><body><script>window.opener.postMessage({type:'google-calendar-auth',success:false,error:'Token exchange failed'},'*');window.close();</script></body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: upsertError } = await supabase
        .from("google_calendar_tokens")
        .upsert({
          user_id: stateData.userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
        }, {
          onConflict: "user_id",
        });

      if (upsertError) {
        return redirectToClientCallback(appCallbackUrl, { success: "false", error: "Failed to store tokens" });
      }

      return redirectToClientCallback(appCallbackUrl, { success: "true" });
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
        .from("google_calendar_tokens")
        .select("id, token_expires_at")
        .eq("user_id", userData.user.id)
        .single();

      return new Response(JSON.stringify({
        connected: !!tokenData,
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
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", userData.user.id);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fetch events (main feature)
    if (action === "events") {
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

      // Get stored tokens
      const { data: tokenRow } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: "Not connected", events: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if expired
      let accessToken = tokenRow.access_token;
      const isExpired = new Date(tokenRow.token_expires_at) < new Date();
      if (isExpired) {
        try {
          accessToken = await refreshGoogleAccessToken(tokenRow.refresh_token);
          const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
          await supabase
            .from("google_calendar_tokens")
            .update({ access_token: accessToken, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
            .eq("user_id", userData.user.id);
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          return new Response(JSON.stringify({ error: "Token expired, reconnect needed", events: [] }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Fetch events — use query params timeMin/timeMax if provided, otherwise default to next 14 days
      const timeMinParam = url.searchParams.get("timeMin");
      const timeMaxParam = url.searchParams.get("timeMax");
      const now = new Date();
      const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const calendarUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      calendarUrl.searchParams.set("timeMin", timeMinParam || now.toISOString());
      calendarUrl.searchParams.set("timeMax", timeMaxParam || twoWeeksLater.toISOString());
      calendarUrl.searchParams.set("singleEvents", "true");
      calendarUrl.searchParams.set("orderBy", "startTime");
      calendarUrl.searchParams.set("maxResults", "100");

      const calendarResponse = await fetch(calendarUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!calendarResponse.ok) {
        const errorText = await calendarResponse.text();
        console.error("Calendar API error:", errorText);
        return new Response(JSON.stringify({ error: "Calendar API error", events: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const calendarData = await calendarResponse.json();
      const events = (calendarData.items || []).map((event: any) => ({
        id: event.id,
        summary: event.summary || "(Sans titre)",
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !event.start?.dateTime,
        attendees: (event.attendees || []).length,
        htmlLink: event.htmlLink || null,
      }));

      return new Response(JSON.stringify({ events }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: create a calendar event
    if (action === "create-event") {
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

      const { data: tokenRow } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: "Not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let accessToken = tokenRow.access_token;
      const isExpired = new Date(tokenRow.token_expires_at) < new Date();
      if (isExpired) {
        accessToken = await refreshGoogleAccessToken(tokenRow.refresh_token);
        const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
        await supabase
          .from("google_calendar_tokens")
          .update({ access_token: accessToken, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq("user_id", userData.user.id);
      }

      const body = await req.json();
      const { summary, description, location, startDateTime, endDateTime, attendeeEmail } = body;

      if (!summary || !startDateTime || !endDateTime) {
        return new Response(JSON.stringify({ error: "Missing required fields: summary, startDateTime, endDateTime" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const eventPayload: Record<string, unknown> = {
        summary,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
        reminders: { useDefault: true },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };
      if (description) eventPayload.description = description;
      if (location) eventPayload.location = location;
      const attendeesList = Array.isArray(attendeeEmail)
        ? attendeeEmail
        : typeof attendeeEmail === "string"
          ? attendeeEmail.split(/[,;\s]+/)
          : [];
      const cleanedAttendees = attendeesList
        .map((e: string) => e.trim())
        .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (cleanedAttendees.length > 0) {
        eventPayload.attendees = cleanedAttendees.map((email: string) => ({ email }));
      }

      const createResponse = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Calendar create event error:", errorText);
        const calendarError = getGoogleCalendarCreateError(errorText);
        return new Response(JSON.stringify({ error: calendarError.message, reason: calendarError.reason }), {
          status: calendarError.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createdEvent = await createResponse.json();
      const meetLink = createdEvent.conferenceData?.entryPoints?.find(
        (ep: { entryPointType: string; uri: string }) => ep.entryPointType === "video"
      )?.uri ?? null;
      return new Response(JSON.stringify({
        id: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        summary: createdEvent.summary,
        meetLink,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in google-calendar-events:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
