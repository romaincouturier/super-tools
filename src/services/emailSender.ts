import { supabase } from "@/integrations/supabase/client";

// ── Thank-you email ─────────────────────────────────────────────────

export interface SendThankYouEmailResult {
  recipientCount: number;
}

/**
 * Invoke the send-thank-you-email edge function.
 * When `testEmail` is provided, sends only a test email to that address.
 */
export async function sendThankYouEmail(
  trainingId: string,
  testEmail?: string,
): Promise<SendThankYouEmailResult> {
  const body: Record<string, string> = { trainingId };
  if (testEmail) {
    body.testEmail = testEmail;
  }

  const { data, error } = await supabase.functions.invoke("send-thank-you-email", {
    body,
  });

  if (error) throw error;

  return data as SendThankYouEmailResult;
}
