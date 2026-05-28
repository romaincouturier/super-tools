import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  createParticipant,
  logParticipantActivity,
  sendParticipantWelcomeEmail,
  generateWoocommerceCoupon,
  sendElearningAccess,
  scheduleParticipantEmail,
  scheduleTrainerSummary,
  catchUpAttendanceSignaturesForParticipant,
} from "@/services/participants";
import { getEmailMode, isTrainingOngoing } from "@/lib/emailScheduling";
import type { Participant } from "@/hooks/useEditParticipant";

export interface RepositioningTarget {
  id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  format_formation: string | null;
  session_format: string | null;
  max_participants: number | null;
  participant_count: number;
}

export async function fetchRepositioningTargets(
  currentTrainingId: string,
): Promise<RepositioningTarget[]> {
  const { data: current, error: curErr } = await supabase
    .from("trainings")
    .select("catalog_id, format_formation")
    .eq("id", currentTrainingId)
    .maybeSingle();
  if (curErr || !current?.catalog_id) return [];

  const today = new Date().toISOString().split("T")[0];
  const { data: sessions, error } = await supabase
    .from("trainings")
    .select(
      "id, training_name, start_date, end_date, location, format_formation, session_format, max_participants",
    )
    .eq("catalog_id", current.catalog_id)
    .eq("format_formation", current.format_formation)
    .or(`start_date.gte.${today},start_date.is.null`)
    .neq("id", currentTrainingId)
    .or("is_cancelled.is.null,is_cancelled.eq.false")
    .order("start_date", { ascending: true });
  if (error || !sessions) return [];

  // Counts per training
  const ids = sessions.map((s) => s.id);
  let countsMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: parts } = await supabase
      .from("training_participants")
      .select("training_id")
      .in("training_id", ids)
      .is("repositioned_to_training_id", null);
    countsMap = new Map();
    (parts || []).forEach((p) => {
      countsMap.set(p.training_id, (countsMap.get(p.training_id) || 0) + 1);
    });
  }

  return sessions.map((s) => ({
    ...s,
    participant_count: countsMap.get(s.id) || 0,
  }));
}

interface RepositionResult {
  newParticipantId: string;
  welcomeSent: boolean;
  welcomeFailed: boolean;
  needsSurveySkipped: boolean;
  attendanceCatchUpSlots: number;
  status: string;
  ongoing: boolean;
  reusedExisting: boolean;
}

/**
 * Move a participant to another training session.
 * - Creates a new participant row in the target session (copying everything).
 * - Marks the source row as `repositioned_to_training_id` (kept for traceability).
 * - Re-runs the full onboarding email flow as if it were a brand new add.
 */
export async function repositionParticipant(
  source: Participant,
  target: RepositioningTarget,
): Promise<RepositionResult> {
  const isInter =
    target.format_formation === "inter-entreprises" ||
    target.format_formation === "e_learning";
  const formatFormation = target.format_formation;

  const { status, sendWelcomeNow } = getEmailMode(target.start_date || undefined);
  const ongoing = isTrainingOngoing(
    target.start_date || undefined,
    target.end_date || undefined,
  );

  const token = crypto.randomUUID();
  const coachingTotal = source.coaching_sessions_total || 0;
  const coachingDeadline =
    coachingTotal > 0
      ? (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() + 1);
          return format(d, "yyyy-MM-dd");
        })()
      : null;

  // Check if participant already exists in target session (avoid unique violation)
  const { data: existing } = await supabase
    .from("training_participants")
    .select("id")
    .eq("training_id", target.id)
    .eq("email", source.email)
    .maybeSingle();

  let inserted: { id: string } | null = null;
  let reusedExisting = false;

  if (existing?.id) {
    inserted = { id: existing.id };
    reusedExisting = true;
  } else {
    inserted = await createParticipant({
      trainingId: target.id,
      firstName: source.first_name || "",
      lastName: source.last_name || "",
      email: source.email,
      company: source.company || "",
      token,
      status,
      formulaId: source.formula_id || "",
      formulaName: source.formula || "",
      coachingTotal,
      coachingDeadline,
      isInterEntreprise: isInter,
      sponsorFirstName: source.sponsor_first_name || "",
      sponsorLastName: source.sponsor_last_name || "",
      sponsorEmail: source.sponsor_email || "",
      financeurSameAsSponsor: source.financeur_same_as_sponsor ?? true,
      financeurName: source.financeur_name || "",
      financeurUrl: source.financeur_url || "",
      paymentMode: (source.payment_mode === "online" ? "online" : "invoice"),
      soldPriceHt: source.sold_price_ht != null ? String(source.sold_price_ht) : "",
    });
  }

  if (!inserted) throw new Error("Échec de création du participant cible");

  // Mark source as repositioned (keep traceability)
  await supabase
    .from("training_participants")
    .update({
      repositioned_to_training_id: target.id,
      repositioned_at: new Date().toISOString(),
    } as never)
    .eq("id", source.id);

  // ---- Mirror useAddParticipant onboarding flow (skip if reusing existing inscription) ----
  const shouldSendWelcome =
    !reusedExisting &&
    formatFormation !== "e_learning" && (status !== "non_envoye" || ongoing);
  let welcomeFailed = false;
  if (shouldSendWelcome) {
    try {
      await sendParticipantWelcomeEmail(inserted.id, target.id);
    } catch (err) {
      console.error("[reposition] welcome email failed:", err);
      welcomeFailed = true;
    }
  }

  let attendanceCatchUpSlots = 0;
  if (!reusedExisting && ongoing && formatFormation !== "e_learning") {
    try {
      const r = await catchUpAttendanceSignaturesForParticipant(target.id, inserted.id);
      attendanceCatchUpSlots = r?.sentSlots || 0;
    } catch (err) {
      console.error("[reposition] attendance catch-up failed:", err);
    }
  }

  if (!reusedExisting && formatFormation === "e_learning" && source.payment_mode !== "online") {
    let couponCode: string | undefined;
    try {
      const r = await generateWoocommerceCoupon(inserted.id, target.id);
      if (!r.error && r.couponCode) couponCode = r.couponCode;
    } catch (err) {
      console.error("[reposition] coupon failed:", err);
    }
    try {
      await sendElearningAccess(inserted.id, target.id, couponCode);
    } catch (err) {
      console.error("[reposition] e-learning access failed:", err);
    }
  }

  let needsSurveySkipped = false;
  const trainingInFuture = status !== "non_envoye" && !ongoing;
  if (!reusedExisting && trainingInFuture && target.start_date && formatFormation !== "e_learning") {
    try {
      const ok = await scheduleParticipantEmail(target.id, inserted.id, target.start_date);
      needsSurveySkipped = !ok;
    } catch (err) {
      console.error("[reposition] schedule needs survey failed:", err);
    }
  }

  if (target.start_date && status !== "non_envoye") {
    try {
      await scheduleTrainerSummary(target.id, target.start_date);
    } catch (err) {
      console.error("[reposition] trainer summary failed:", err);
    }
  }

  await logParticipantActivity(
    target.id,
    source.email,
    source.first_name || "",
    source.last_name || "",
    source.company || "",
  );

  return {
    newParticipantId: inserted.id,
    welcomeSent: shouldSendWelcome && !welcomeFailed,
    welcomeFailed,
    needsSurveySkipped,
    attendanceCatchUpSlots,
    status,
    ongoing,
  };
}
