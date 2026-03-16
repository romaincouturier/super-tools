// Re-export everything from the decomposed crm/ modules for backward compatibility.
// Existing imports from "@/hooks/useCrmBoard" continue to work unchanged.
export {
  CRM_QUERY_KEY,
  useCrmBoard,
  useCrmCardDetails,
  useCreateColumn,
  useUpdateColumn,
  useArchiveColumn,
  useReorderColumns,
  useCreateCard,
  useUpdateCard,
  useMoveCard,
  useDeleteCard,
  useExtractOpportunity,
  useCreateTag,
  useDeleteTag,
  useAssignTag,
  useUnassignTag,
  useAddComment,
  useDeleteComment,
  useAddAttachment,
  useDeleteAttachment,
  useSendEmail,
  useCrmReports,
  useCrmSettings,
  useUpdateCrmSettings,
} from "./crm/index";

export type { ServiceTypeColors } from "./crm/index";
