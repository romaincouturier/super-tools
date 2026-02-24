import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createJsonResponse,
} from "../_shared/mod.ts";

/**
 * Process CRM Reminders — DEPRECATED
 *
 * CRM alerts are now consolidated into the daily digest
 * sent by process-logistics-reminders.
 *
 * This function is kept as a no-op for backwards compatibility
 * with existing cron jobs. It can be safely removed once the
 * cron schedule is updated.
 */

const VERSION = "process-crm-reminders@2.0.0";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  console.log(`[${VERSION}] CRM reminders are now consolidated into the daily digest (process-logistics-reminders). Skipping.`);

  return createJsonResponse({
    success: true,
    message: "CRM reminders consolidated into daily digest. This function is a no-op.",
    _version: VERSION,
  });
});
