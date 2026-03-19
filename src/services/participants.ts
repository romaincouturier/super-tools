import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { capitalizeName } from "@/lib/stringUtils";
import { logActivity, scheduleEmail } from "@/services/activityLog";

/** Sanitize a filename by removing accents and special characters (preserving case). */
function sanitizeUploadName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
}

// Re-usable helper: capitalizeName returns string|null, but createParticipant needs string
const capitalizeOrEmpty = (name: string): string => capitalizeName(name) ?? "";

export interface CreateParticipantInput {
  trainingId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  token: string;
  status: string;
  formulaId: string;
  formulaName: string;
  coachingTotal: number;
  coachingDeadline: string | null;
  isInterEntreprise: boolean;
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  financeurSameAsSponsor: boolean;
  financeurName: string;
  financeurUrl: string;
  paymentMode: "online" | "invoice";
  soldPriceHt: string;
}

/**
 * Insert a new participant into training_participants and create the
 * associated questionnaire_besoins record.
 */
export async function createParticipant(input: CreateParticipantInput) {
  const participantData = {
    training_id: input.trainingId,
    first_name: capitalizeOrEmpty(input.firstName) || null,
    last_name: capitalizeOrEmpty(input.lastName) || null,
    email: input.email.trim().toLowerCase(),
    company: input.company.trim() || null,
    needs_survey_token: input.token,
    needs_survey_status: input.status,
    coaching_sessions_total: input.coachingTotal,
    coaching_sessions_completed: 0,
    coaching_deadline: input.coachingDeadline,
    ...(input.formulaId && {
      formula: input.formulaName,
      formula_id: input.formulaId,
    }),
    ...(input.isInterEntreprise && {
      sponsor_first_name: capitalizeOrEmpty(input.sponsorFirstName) || null,
      sponsor_last_name: capitalizeOrEmpty(input.sponsorLastName) || null,
      sponsor_email: input.sponsorEmail.trim().toLowerCase() || null,
      financeur_same_as_sponsor: input.financeurSameAsSponsor,
      financeur_name: !input.financeurSameAsSponsor ? (input.financeurName.trim() || null) : null,
      financeur_url: !input.financeurSameAsSponsor ? (input.financeurUrl.trim() || null) : null,
      payment_mode: input.paymentMode,
      sold_price_ht: input.soldPriceHt ? parseFloat(input.soldPriceHt) : null,
    }),
  };

  const { data: insertedParticipant, error } = await supabase
    .from("training_participants")
    .insert(participantData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Create questionnaire_besoins record immediately so the link works from day 1
  if (insertedParticipant) {
    try {
      await supabase.from("questionnaire_besoins").insert({
        participant_id: insertedParticipant.id,
        training_id: input.trainingId,
        token: input.token,
        etat: "non_envoye",
        email: input.email.trim().toLowerCase(),
        prenom: input.firstName.trim() || null,
        nom: input.lastName.trim() || null,
        societe: input.company.trim() || null,
      });
    } catch (qErr) {
      console.warn("Failed to pre-create questionnaire record:", qErr);
    }
  }

  return insertedParticipant;
}

/**
 * Log participant addition to activity_logs.
 */
export async function logParticipantActivity(
  trainingId: string,
  email: string,
  firstName: string,
  lastName: string,
  company: string,
) {
  await logActivity({
    actionType: "participant_added",
    recipientEmail: email.trim().toLowerCase(),
    details: {
      training_id: trainingId,
      participant_name: `${firstName.trim() || ""} ${lastName.trim() || ""}`.trim() || null,
      company: company.trim() || null,
    },
  });
}

/**
 * Invoke the send-welcome-email edge function.
 */
export async function sendParticipantWelcomeEmail(participantId: string, trainingId: string) {
  await supabase.functions.invoke("send-welcome-email", {
    body: {
      participantId,
      trainingId,
    },
  });
}

/**
 * Invoke the generate-woocommerce-coupon edge function.
 * Returns the coupon code if successful, undefined otherwise.
 */
export async function generateWoocommerceCoupon(
  participantId: string,
  trainingId: string,
): Promise<{ couponCode?: string; error?: boolean }> {
  const { data: couponData, error: couponError } = await supabase.functions.invoke(
    "generate-woocommerce-coupon",
    {
      body: {
        participantId,
        trainingId,
      },
    },
  );

  if (couponError) {
    console.error("Failed to generate WooCommerce coupon:", couponError);
    return { error: true };
  }

  return { couponCode: couponData?.coupon_code };
}

/**
 * Invoke the send-elearning-access edge function.
 */
export async function sendElearningAccess(
  participantId: string,
  trainingId: string,
  couponCode?: string,
) {
  await supabase.functions.invoke("send-elearning-access", {
    body: {
      participantId,
      trainingId,
      couponCode,
    },
  });
}

/**
 * Schedule a needs survey email for a participant.
 * Returns true if the email was actually scheduled, false if the date was already past.
 */
export async function scheduleParticipantEmail(
  trainingId: string,
  participantId: string,
  trainingStartDate: string,
): Promise<boolean> {
  const [workingDays, needsSurveyDelay] = await Promise.all([
    fetchWorkingDays(supabase),
    fetchNeedsSurveyDelay(supabase),
  ]);

  const startDate = parseISO(trainingStartDate);
  const scheduledDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDays);

  // Only schedule if the date is in the future
  if (scheduledDate > new Date()) {
    await scheduleEmail({
      trainingId,
      participantId,
      emailType: "needs_survey",
      scheduledFor: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
    });
    return true;
  }

  return false;
}

/**
 * Schedule a welcome email for a participant (for trainings > 7 days away).
 * The email will be sent at J-7 working days before the training start date.
 */
export async function scheduleWelcomeEmail(
  trainingId: string,
  participantId: string,
  trainingStartDate: string,
): Promise<boolean> {
  const workingDays = await fetchWorkingDays(supabase);
  const startDate = parseISO(trainingStartDate);
  const scheduledDate = subtractWorkingDays(startDate, 7, workingDays);

  if (scheduledDate > new Date()) {
    await scheduleEmail({
      trainingId,
      participantId,
      emailType: "welcome",
      scheduledFor: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
    });
    return true;
  }

  return false;
}


export async function scheduleTrainerSummary(trainingId: string, trainingStartDate: string) {
  await scheduleTrainerSummaryIfNeeded(supabase, trainingId, trainingStartDate);
}

/**
 * Fetch existing financeur names from both trainings and training_participants tables.
 */
export async function fetchExistingFinanceurs(): Promise<string[]> {
  const [fromTrainings, fromParticipants] = await Promise.all([
    supabase.from("trainings").select("financeur_name").not("financeur_name", "is", null).not("financeur_name", "eq", ""),
    supabase.from("training_participants").select("financeur_name").not("financeur_name", "is", null).not("financeur_name", "eq", ""),
  ]);

  const allNames = new Set<string>();
  (fromTrainings.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
  (fromParticipants.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
  return Array.from(allNames).sort();
}

// ─── Edit participant services ──────────────────────────────────────────────

export interface ParticipantFile {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

export interface ConventionSignatureStatus {
  signed_pdf_url: string | null;
  signed_at: string | null;
  status: string;
}

/** Update a training participant's data. */
export async function updateParticipant(
  participantId: string,
  updateData: Record<string, unknown>,
) {
  return supabase
    .from("training_participants")
    .update(updateData)
    .eq("id", participantId);
}

/** Sync evaluation record after participant update. */
export async function updateParticipantEvaluation(
  participantId: string,
  data: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  },
) {
  return supabase
    .from("training_evaluations")
    .update(data)
    .eq("participant_id", participantId);
}

/** Fetch the convention signature status for a participant's sponsor. */
export async function fetchConventionSignature(
  trainingId: string,
  sponsorEmail: string,
): Promise<ConventionSignatureStatus | null> {
  const { data } = await supabase
    .from("convention_signatures")
    .select("signed_pdf_url, signed_at, status")
    .eq("training_id", trainingId)
    .eq("recipient_email", sponsorEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/** Fetch files attached to a participant. */
export async function fetchParticipantFiles(
  participantId: string,
): Promise<ParticipantFile[]> {
  const { data, error } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("participant_files")
    .select("id, file_url, file_name, uploaded_at")
    .eq("participant_id", participantId)
    .order("uploaded_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

/** Fetch WooCommerce coupon code for a participant. */
export async function fetchCouponCode(
  participantId: string,
): Promise<string | null> {
  const { data } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("woocommerce_coupons")
    .select("coupon_code")
    .eq("participant_id", participantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.coupon_code || null;
}

/** Upload a file to storage and insert a participant_files record. */
export async function uploadParticipantFile(
  trainingId: string,
  participantId: string,
  file: File,
): Promise<ParticipantFile> {
  const sanitized = sanitizeUploadName(file.name);
  const path = `${trainingId}/participant_${participantId}/fichier_${Date.now()}_${sanitized}`;

  const { error: uploadErr } = await supabase.storage
    .from("training-documents")
    .upload(path, file);
  if (uploadErr) throw uploadErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from("training-documents").getPublicUrl(path);

  const { data: insertedFile, error: insertErr } = await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("participant_files")
    .insert({
      participant_id: participantId,
      file_url: publicUrl,
      file_name: file.name,
    })
    .select("id, file_url, file_name, uploaded_at")
    .single();

  if (insertErr) throw insertErr;
  return insertedFile;
}

/** Delete a participant file (storage + DB record). */
export async function deleteParticipantFile(
  fileToDelete: ParticipantFile,
): Promise<void> {
  const urlParts = fileToDelete.file_url.split("/training-documents/");
  if (urlParts.length > 1) {
    await supabase.storage.from("training-documents").remove([urlParts[1]]);
  }

  await (supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> })
    .from("participant_files")
    .delete()
    .eq("id", fileToDelete.id);
}

/** Upload a signed convention PDF for a participant. */
export async function uploadSignedConvention(
  trainingId: string,
  participantId: string,
  file: File,
): Promise<string> {
  const sanitized = sanitizeUploadName(file.name);
  const path = `${trainingId}/participant_${participantId}/convention_signee_${Date.now()}_${sanitized}`;

  const { error: uploadErr } = await supabase.storage
    .from("training-documents")
    .upload(path, file);
  if (uploadErr) throw uploadErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from("training-documents").getPublicUrl(path);

  await supabase
    .from("training_participants")
    .update({ signed_convention_url: publicUrl } as Record<string, unknown>)
    .eq("id", participantId);

  return publicUrl;
}

/** Delete a signed convention (storage + clear DB field). */
export async function deleteSignedConvention(
  participantId: string,
  conventionUrl: string,
): Promise<void> {
  const urlParts = conventionUrl.split("/training-documents/");
  if (urlParts.length > 1) {
    await supabase.storage.from("training-documents").remove([urlParts[1]]);
  }
  await supabase
    .from("training_participants")
    .update({ signed_convention_url: null } as Record<string, unknown>)
    .eq("id", participantId);
}
