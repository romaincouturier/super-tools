// CQRS barrel re-exports — queries and mutations are now separated
// Queries: @/hooks/queries/useOKRQueries
// Mutations: @/hooks/mutations/useOKRMutations

export {
  OKR_OBJECTIVES_KEY,
  OKR_KEY_RESULTS_KEY,
  OKR_INITIATIVES_KEY,
  OKR_PARTICIPANTS_KEY,
  OKR_CHECK_INS_KEY,
  OKR_FAVORITES_KEY,
  useOKRObjectives,
  useOKRObjective,
  useOKRFavorites,
  useOKRKeyResults,
  useOKRInitiatives,
  useOKRParticipants,
  useOKRCheckIns,
  useOKRStatistics,
} from "@/hooks/queries/useOKRQueries";

export {
  useCreateOKRObjective,
  useUpdateOKRObjective,
  useDeleteOKRObjective,
  useToggleOKRFavorite,
  useCreateOKRKeyResult,
  useUpdateOKRKeyResult,
  useDeleteOKRKeyResult,
  useCreateOKRInitiative,
  useUpdateOKRInitiative,
  useDeleteOKRInitiative,
  useAddOKRParticipant,
  useRemoveOKRParticipant,
  useCreateOKRCheckIn,
} from "@/hooks/mutations/useOKRMutations";
