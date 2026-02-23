// CQRS barrel re-exports — queries and mutations are now separated
// Queries: @/hooks/queries/useEventQueries
// Mutations: @/hooks/mutations/useEventMutations

export {
  EVENTS_KEY,
  EVENT_MEDIA_KEY,
  useEvents,
  useEvent,
  useEventMedia,
} from "@/hooks/queries/useEventQueries";

export {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useAddEventMedia,
  useDeleteEventMedia,
} from "@/hooks/mutations/useEventMutations";
