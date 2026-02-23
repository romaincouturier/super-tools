/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Event, EventMedia } from "@/types/events";

export const EVENTS_KEY = "events";
export const EVENT_MEDIA_KEY = "event-media";

export const useEvents = () => {
  return useQuery({
    queryKey: [EVENTS_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Event[];
    },
  });
};

export const useEvent = (id: string | undefined) => {
  return useQuery({
    queryKey: [EVENTS_KEY, id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};

export const useEventMedia = (eventId: string | undefined) => {
  return useQuery({
    queryKey: [EVENT_MEDIA_KEY, eventId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("event_media")
        .select("*")
        .eq("event_id", eventId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as EventMedia[];
    },
    enabled: !!eventId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
};
