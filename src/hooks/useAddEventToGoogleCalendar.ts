import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/events";

export interface AddEventToGoogleCalendarResult {
  ok: boolean;
  noSession: boolean;
  notConnected: boolean;
  error?: string;
  htmlLink?: string;
}

/** Ajoute un évènement du module Évènements dans le Google Agenda de l'utilisateur. */
export function useAddEventToGoogleCalendar() {
  const [loading, setLoading] = useState(false);

  const addEvent = async (event: Event): Promise<AddEventToGoogleCalendarResult> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { ok: false, noSession: true, notConnected: false };

      const time = event.event_time ? event.event_time.slice(0, 5) : "09:00";
      const start = new Date(`${event.event_date}T${time}:00`);
      const endTime = event.event_end_time ? event.event_end_time.slice(0, 5) : null;
      const end = endTime
        ? new Date(`${event.event_date}T${endTime}:00`)
        : new Date(start.getTime() + 60 * 60 * 1000);
      if (end.getTime() <= start.getTime()) end.setTime(start.getTime() + 60 * 60 * 1000);


      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=create-event`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: event.title,
            description: [event.description, event.event_url].filter(Boolean).join("\n\n"),
            location: event.location || "",
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        return {
          ok: false,
          noSession: false,
          notConnected: data.error === "Not connected",
          error: data.error || `Erreur ${res.status}`,
        };
      }

      return { ok: true, noSession: false, notConnected: false, htmlLink: data.htmlLink };
    } finally {
      setLoading(false);
    }
  };

  return { loading, addEvent };
}
