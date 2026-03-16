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

// ── Training documents delivery ─────────────────────────────────────

export interface SendTrainingDocumentsInput {
  trainingId: string;
  trainingName: string;
  startDate: string | null;
  endDate: string | null;
  recipientEmail: string;
  recipientName: string | null;
  recipientFirstName: string | null;
  formalAddress: boolean;
}

/**
 * Invoke the send-training-documents edge function.
 */
export async function sendTrainingDocuments(
  input: SendTrainingDocumentsInput,
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-training-documents", {
    body: input,
  });

  if (error) throw error;
}
