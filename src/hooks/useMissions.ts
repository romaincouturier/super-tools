// CQRS barrel re-exports — queries and mutations are now separated
// Queries: @/hooks/queries/useMissionQueries
// Mutations: @/hooks/mutations/useMissionMutations

export {
  MISSIONS_QUERY_KEY,
  MISSION_ACTIVITIES_QUERY_KEY,
  MISSION_PAGES_QUERY_KEY,
  MISSION_PAGE_TEMPLATES_QUERY_KEY,
  MISSION_CONTACTS_QUERY_KEY,
  useMissions,
  useSearchMissions,
  useMissionActivities,
  useMissionPages,
  useMissionPageTemplates,
  useMissionContacts,
} from "@/hooks/queries/useMissionQueries";

export type {
  MissionActivity,
  MissionPage,
  MissionPageTemplate,
} from "@/hooks/queries/useMissionQueries";

export {
  useCreateMission,
  useUpdateMission,
  useDeleteMission,
  useMoveMission,
  useCreateMissionActivity,
  useUpdateMissionActivity,
  useDeleteMissionActivity,
  useCreateMissionPage,
  useUpdateMissionPage,
  useDeleteMissionPage,
  useCreateMissionPageTemplate,
  useUpdateMissionPageTemplate,
  useDeleteMissionPageTemplate,
  useCreateMissionContact,
  useUpdateMissionContact,
  useDeleteMissionContact,
} from "@/hooks/mutations/useMissionMutations";
