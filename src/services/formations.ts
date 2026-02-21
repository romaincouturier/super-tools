import { supabase } from "@/integrations/supabase/client";

// --- Edge function invocations ---

export async function generateConvention(params: {
  trainingId: string;
  participantId?: string;
  subrogation?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendConventionEmail(params: {
  trainingId: string;
  conventionUrl: string;
  recipientEmail: string;
  recipientName?: string;
  recipientFirstName?: string;
  formalAddress?: boolean;
  conventionFileName?: string;
  enableOnlineSignature?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("send-convention-email", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendConventionReminder(params: {
  trainingId: string;
  participantId: string;
}) {
  const { data, error } = await supabase.functions.invoke("send-convention-reminder", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function generateCertificates(params: {
  trainingId: string;
  participantIds?: string[];
}) {
  const { data, error } = await supabase.functions.invoke("generate-certificates", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendTrainingDocuments(params: {
  trainingId: string;
  participantId?: string;
}) {
  const { data, error } = await supabase.functions.invoke("send-training-documents", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendThankYouEmail(params: {
  trainingId: string;
  participantId?: string;
}) {
  const { data, error } = await supabase.functions.invoke("send-thank-you-email", {
    body: params,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// --- Activity logs ---

export async function fetchDocumentsSentInfo(trainingId: string) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("created_at, action_type, details")
    .in("action_type", [
      "training_documents_sent",
      "thank_you_email_sent",
      "convention_email_sent",
    ])
    .order("created_at", { ascending: false });

  if (error) throw error;

  let documentsSentAt: string | null = null;
  let thankYouSentAt: string | null = null;
  let conventionSentAt: string | null = null;

  for (const log of data || []) {
    const logDetails = log.details as Record<string, unknown> | null;
    const logTrainingId = logDetails?.training_id || logDetails?.trainingId;
    if (logTrainingId !== trainingId) continue;

    if (log.action_type === "training_documents_sent" && !documentsSentAt) {
      documentsSentAt = log.created_at;
    }
    if (log.action_type === "thank_you_email_sent" && !thankYouSentAt) {
      thankYouSentAt = log.created_at;
    }
    if (log.action_type === "convention_email_sent" && !conventionSentAt) {
      conventionSentAt = log.created_at;
    }
  }

  return { documentsSentAt, thankYouSentAt, conventionSentAt };
}

// --- Convention signature status ---

export async function fetchConventionSignatureStatus(trainingId: string) {
  const { data, error } = await supabase
    .from("convention_signatures")
    .select(
      "status, signed_at, audit_metadata, ip_address, proof_file_url, proof_hash, signed_pdf_url, journey_events, pdf_hash"
    )
    .eq("training_id", trainingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// --- Programs ---

export async function fetchPrograms() {
  const { data, error } = await supabase
    .from("training_programs")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

// --- Participants ---

export async function insertParticipant(params: {
  training_id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  company?: string;
  phone?: string;
  job_title?: string;
  sold_price_ht?: number;
}) {
  const { data, error } = await supabase
    .from("training_participants")
    .insert(params)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateParticipant(
  participantId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("training_participants")
    .update(updates)
    .eq("id", participantId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteParticipant(participantId: string) {
  const { error } = await supabase
    .from("training_participants")
    .delete()
    .eq("id", participantId);

  if (error) throw error;
}
