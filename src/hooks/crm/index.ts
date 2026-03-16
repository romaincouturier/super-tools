// Barrel re-export — backward-compatible public API
export { CRM_QUERY_KEY } from "./useCrmMutation";

// Board & details queries
export { useCrmBoard } from "./useCrmBoard";
export { useCrmCardDetails } from "./useCrmCardDetails";

// Column mutations
export { useCreateColumn, useUpdateColumn, useArchiveColumn, useReorderColumns } from "./useCrmColumnMutations";

// Card mutations
export { useCreateCard, useUpdateCard, useMoveCard, useDeleteCard, useExtractOpportunity } from "./useCrmCardMutations";

// Tag mutations
export { useCreateTag, useDeleteTag, useAssignTag, useUnassignTag } from "./useCrmTagMutations";

// Comments
export { useAddComment, useDeleteComment } from "./useCrmComments";

// Attachments
export { useAddAttachment, useDeleteAttachment } from "./useCrmAttachments";

// Email
export { useSendEmail } from "./useCrmEmail";

// Reports
export { useCrmReports } from "./useCrmReports";

// Settings
export { useCrmSettings, useUpdateCrmSettings } from "./useCrmSettings";
export type { ServiceTypeColors } from "./useCrmSettings";
