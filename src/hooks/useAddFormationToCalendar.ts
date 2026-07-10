import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFormationCalendarEvents,
  type FormationScheduleDay,
} from "@/lib/formationCalendarEvents";

export interface AddFormationToCalendarParams {
  trainingId: string;
  trainingName: string;
  clientName: string | null;
  location: string;
  schedules: FormationScheduleDay[];
  isPresentiel: boolean;
}

export interface AddFormationToCalendarResult {
  ok: number;
  noSession: boolean;
  notConnected: boolean;
  failures: string[];
}

export function useAddFormationToCalendar() {
  const [loading, setLoading] = useState(false);

  const addToCalendar = async (
    params: AddFormationToCalendarParams,
  ): Promise<AddFormationToCalendarResult> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { ok: 0, noSession: true, notConnected: false, failures: [] };
      }

      const events = buildFormationCalendarEvents({
        ...params,
        appUrl: window.location.origin,
      });

      let ok = 0;
      let notConnected = false;
      const failures: string[] = [];

      for (const evt of events) {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=create-event`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(evt),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          if (data.error === "Not connected") {
            notConnected = true;
            break;
          }
          failures.push(`${evt.summary} : ${data.error || res.status}`);
        } else {
          ok += 1;
        }
      }

      return { ok, noSession: false, notConnected, failures };
    } finally {
      setLoading(false);
    }
  };

  return { loading, addToCalendar };
}
