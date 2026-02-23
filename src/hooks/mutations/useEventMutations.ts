/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Event, EventMedia } from "@/types/events";
import { EVENTS_KEY, EVENT_MEDIA_KEY } from "@/hooks/queries/useEventQueries";

export const useCreateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Event, "id" | "created_at" | "updated_at" | "created_by">) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      const { data, error } = await (supabase as any)
        .from("events")
        .insert({ ...input, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] });
    },
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] });
    },
  });
};

export const useAddEventMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<EventMedia, "id" | "created_at" | "created_by">) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      const { data, error } = await (supabase as any)
        .from("event_media")
        .insert({ ...input, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as EventMedia;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EVENT_MEDIA_KEY, variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
    },
  });
};

export const useDeleteEventMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await (supabase as any).from("event_media").delete().eq("id", id);
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: [EVENT_MEDIA_KEY, eventId] });
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
    },
  });
};
