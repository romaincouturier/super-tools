/**
 * Shared Modules Index
 *
 * Central export point for all shared utilities
 */

// CORS utilities
export {
  corsHeaders,
  extendCorsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
} from "./cors.ts";

// Signitic signature
export { getSigniticSignature } from "./signitic.ts";

// Resend email
export {
  sendEmail,
  escapeHtml,
  type EmailAttachment,
  type SendEmailOptions,
  type SendEmailResult,
} from "./resend.ts";

// BCC settings
export { getBccSettings } from "./bcc-settings.ts";

// Date utilities
export {
  formatDateFr,
  formatDateWithDayFr,
  formatDateRange,
  formatDateForFileName,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatICSDate,
  calculateDurationDays,
} from "./date-utils.ts";

// Supabase client
export {
  getSupabaseClient,
  createSupabaseClient,
  verifyAuth,
} from "./supabase-client.ts";

// Failed emails logger
export { logFailedEmail } from "./failed-emails.ts";

// Templates
export {
  processTemplate,
  replaceVariables,
  textToHtml,
  wrapEmailHtml,
  emailButton,
  emailInfoBox,
  emailSuccessBox,
  type TemplateVariables,
} from "./templates.ts";

// Crypto utilities
export {
  generateHash,
  hashArrayBuffer,
  getClientIp,
} from "./crypto.ts";

// App URLs
export { getAppUrls } from "./app-urls.ts";

// Working days
export {
  fetchWorkingDays,
  isTodayWorkingDay,
  skipIfNonWorkingDay,
} from "./working-days.ts";

// Daily data fetchers (shared between digest email & daily actions)
export {
  fetchAllDailyData,
  fetchRecipients,
  userCanSee,
  REVIEW_COLUMN_ASSIGNMENTS,
  REVIEW_COLUMN_IDS,
  type DailyData,
  type Recipient,
  type MissionActionItem,
  type ElearningGroupItem,
  type MissionInvoiceItem,
  type UnbilledActivityItem,
  type MissionNoDateItem,
  type CrmCardItem,
  type TrainingConventionItem,
  type ReviewArticleItem,
  type BlockedArticleItem,
  type UnresolvedCommentItem,
  type EventItem,
  type CfpItem,
  type CfpReminderItem,
  type TrainingInvoiceItem,
  type ReservationItem,
  type OkrInitiativeItem,
} from "./daily-data-fetchers.ts";
