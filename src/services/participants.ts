import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";

/**
 * Capitalize the first letter of each word in a name, handling compound names (hyphen, space).
 * "jean-pierre" → "Jean-Pierre", "DUPONT" → "Dupont", "marie claire" → "Marie Claire"
 */
const capitalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/(\s+|-)/g)
    .map((part) => {
      if (part === "-" || /^\s+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
};

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
    first_name: capitalizeName(input.firstName) || null,
    last_name: capitalizeName(input.lastName) || null,
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
      sponsor_first_name: capitalizeName(input.sponsorFirstName) || null,
      sponsor_last_name: capitalizeName(input.sponsorLastName) || null,
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
  await supabase.from("activity_logs").insert({
    action_type: "participant_added",
    recipient_email: email.trim().toLowerCase(),
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
    await supabase.from("scheduled_emails").insert({
      training_id: trainingId,
      participant_id: participantId,
      email_type: "needs_survey",
      scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
      status: "pending",
    });
    return true;
  }

  return false;
}

/**
 * Schedule trainer summary email if not already scheduled.
 */
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
