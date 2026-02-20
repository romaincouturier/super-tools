/**
 * Shared Modules Index
 *
 * Central export point for all shared utilities
 */

// CORS utilities
export {
  corsHeaders,
  getCorsHeaders,
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

// Validation (Zod)
export {
  z,
  parseBody,
  uuidSchema,
  emailSchema,
  nonEmptyString,
  isoDateString,
  trainingIdSchema,
  participantIdSchema,
  tokenSchema,
} from "./validation.ts";

// Templates
export {
  processTemplate,
  replaceVariables,
  textToHtml,
  wrapEmailHtml,
  type TemplateVariables,
} from "./templates.ts";
