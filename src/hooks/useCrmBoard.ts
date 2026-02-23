// CQRS barrel re-exports — queries and mutations are now separated
// Queries: @/hooks/queries/useCrmQueries
// Mutations: @/hooks/mutations/useCrmMutations

export {
  CRM_QUERY_KEY,
  ServiceTypeColors,
  useCrmBoard,
  useCrmCardDetails,
  useCrmReports,
  useCrmSettings,
} from "@/hooks/queries/useCrmQueries";

export type { ServiceTypeColors as ServiceTypeColorsType } from "@/hooks/queries/useCrmQueries";

export {
  useCreateColumn,
  useUpdateColumn,
  useArchiveColumn,
  useReorderColumns,
  useCreateCard,
  useUpdateCard,
  useMoveCard,
  useDeleteCard,
  useCreateTag,
  useDeleteTag,
  useAssignTag,
  useUnassignTag,
  useAddComment,
  useDeleteComment,
  useAddAttachment,
  useDeleteAttachment,
  useSendEmail,
  useExtractOpportunity,
  useUpdateCrmSettings,
} from "@/hooks/mutations/useCrmMutations";
