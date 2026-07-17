/**
 * add-training-participant
 *
 * Source de vérité unique pour l'ajout d'un participant à une session de
 * formation. Utilisée par :
 *   - supertilt-webhook (ajout automatique depuis WooCommerce)
 *   - le frontend via supabase.functions.invoke (ajout manuel ou en masse)
 *
 * Gère dans un seul endroit :
 *   - La création du participant et du questionnaire_besoins associé
 *   - La détermination du mode email (envoi immédiat, programmé ou aucun)
 *   - L'envoi de la convocation (formations 2–7 j) ou sa programmation J-7
 *   - La programmation du recueil des besoins
 *   - La programmation du récapitulatif formateur
 *   - Le rattrapage d'émargement pour les ajouts en cours de formation
 *   - L'accès e-learning (lien magique ou coupon WooCommerce)
 *   - Le log d'activité
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { fetchWorkingDays, subtractWorkingDays, addWorkingDays } from "../_shared/working-days.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** "jean-pierre DE LA FONTAINE" → "Jean-Pierre De La Fontaine" */
function capitalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim();
  if (!t) return null;
  return t.toLowerCase().replace(/(^|[\s-])(\S)/g, (_m: string, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Détermine le mode d'envoi de la convocation selon la distance à J0.
 *
 * ┌─────────────────────────┬──────────────────┬──────────────────────┐
 * │ Cas                     │ status           │ sendWelcomeNow       │
 * ├─────────────────────────┼──────────────────┼──────────────────────┤
 * │ Pas de date de début    │ programme        │ false (cron J-7)     │
 * │ Déjà commencée (> 0 j)  │ non_envoye       │ false*               │
 * │ Démarre aujourd'hui     │ non_envoye       │ false* (voir ongoing)│
 * │ < 2 j                   │ manuel           │ false                │
 * │ 2–7 j                   │ accueil_envoye   │ true                 │
 * │ > 7 j                   │ programme        │ false (cron J-7)     │
 * └─────────────────────────┴──────────────────┴──────────────────────┘
 * * Pour une formation "en cours" (start ≤ today ≤ end), un ajout
 *   mid-session doit quand même recevoir la convocation : l'appelant
 *   consulte `ongoing` pour outrepasser le `non_envoye`.
 */
function computeEmailMode(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined,
): { status: string; sendWelcomeNow: boolean; ongoing: boolean } {
  if (!startDateStr) return { status: "programme", sendWelcomeNow: false, ongoing: false };

  const start = new Date(`${startDateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const msPerDay = 86_400_000;
  const daysUntilStart = Math.floor((start.getTime() - today.getTime()) / msPerDay);

  const ongoing = endDateStr
    ? (() => {
        const end = new Date(`${endDateStr}T23:59:59`);
        const now = new Date();
        return now >= start && now <= end;
      })()
    : false;

  if (daysUntilStart <= 0) return { status: "non_envoye", sendWelcomeNow: false, ongoing };
  if (daysUntilStart < 2)  return { status: "manuel",         sendWelcomeNow: false, ongoing };
  if (daysUntilStart <= 7) return { status: "accueil_envoye", sendWelcomeNow: true,  ongoing };
  return { status: "programme", sendWelcomeNow: false, ongoing };
}

// ── Request / Response types ──────────────────────────────────────────────────

export interface AddParticipantRequest {
  trainingId: string;
  // Contexte de la session
  trainingStartDate?: string | null;
  trainingEndDate?: string | null;
  /** "e_learning" | "inter-entreprises" | "intra-entreprise" | "classe_virtuelle" | … */
  formatFormation?: string | null;
  isInterEntreprise?: boolean;
  // Données du participant
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyZip?: string | null;
  typeStagiaireBpf?: string | null;
  sourceFinancementBpf?: string | null;
  soldPriceHt?: number | string | null;
  paymentMode?: "online" | "invoice";
  formulaId?: string | null;
  formulaName?: string | null;
  coachingSessionsTotal?: number;
  coachingDeadline?: string | null;
  sponsorFirstName?: string | null;
  sponsorLastName?: string | null;
  sponsorEmail?: string | null;
  financeurSameAsSponsor?: boolean;
  financeurName?: string | null;
  financeurUrl?: string | null;
  notes?: string | null;
  // (WooCommerce coupon generation removed — feature decommissioned)
  // Origine de l'ajout — utilisé pour le log d'activité et certaines règles
  source?: "manual" | "woocommerce" | "bulk";
  // Champs WooCommerce pour le log
  woocommerceOrderId?: number | null;
  woocommerceProductId?: number | null;
  routingReason?: string | null;
}

export interface AddParticipantResponse {
  participantId: string;
  alreadyExisted: boolean;
  status: string;
  ongoing: boolean;
  welcomeSent: boolean;
  welcomeFailed: boolean;
  welcomeScheduled: boolean;
  needsSurveyScheduled: boolean;
  trainerSummaryScheduled: boolean;
  attendanceCatchUp: { sentSlots: number; errors: number } | null;
  elearningAccessSent: boolean;
  elearningMode: "magic_link" | "woocommerce" | null;
  couponGenerated: boolean;
  conventionGenerated: boolean;
  conventionEmailSent: boolean;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  // Allow internal server-to-server calls (e.g. supertilt-webhook) that carry
  // the service role key, and authenticated frontend calls (user JWT).
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  if (!isServiceRole) {
    const user = await verifyAuth(authHeader);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // deno-lint-ignore no-explicit-any
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

  try {
    const body: AddParticipantRequest = await req.json();
    const {
      trainingId,
      trainingStartDate,
      trainingEndDate,
      formatFormation,
      isInterEntreprise = false,
      firstName,
      lastName,
      company,
      companyAddress,
      companyCity,
      companyZip,
      typeStagiaireBpf,
      sourceFinancementBpf,
      soldPriceHt,
      paymentMode = "invoice",
      formulaId,
      formulaName,
      coachingSessionsTotal = 0,
      coachingDeadline,
      sponsorFirstName,
      sponsorLastName,
      sponsorEmail,
      financeurSameAsSponsor = false,
      financeurName,
      financeurUrl,
      notes,
      generateCoupon = false,
      source = "manual",
      woocommerceOrderId,
      woocommerceProductId,
      routingReason,
    } = body;

    const isDraft = (body as { draft?: boolean }).draft === true;

    if (!trainingId || (!body.email && !isDraft)) {
      return new Response(
        JSON.stringify({ error: "trainingId et email sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Duplication "brouillon" ───────────────────────────────────────────────
    // Copie un participant en effaçant nom/prénom/email (placeholder unique car
    // email est NOT NULL + unique par formation). Aucun onboarding n'est déclenché.
    if (isDraft) {
      const placeholderEmail = `brouillon-${crypto.randomUUID().slice(0, 8)}@a-completer.local`;
      const draftRow: Record<string, unknown> = {
        training_id: trainingId,
        email: placeholderEmail,
        first_name: null,
        last_name: null,
        company: company?.trim() || null,
        needs_survey_token: crypto.randomUUID(),
        needs_survey_status: "non_envoye",
        coaching_sessions_total: coachingSessionsTotal,
        coaching_sessions_completed: 0,
        coaching_deadline: coachingDeadline || null,
        ...(formulaId && { formula: formulaName || null, formula_id: formulaId }),
        ...(notes && { notes }),
        ...(isInterEntreprise && {
          company_address: companyAddress?.trim() || null,
          company_city: companyCity?.trim() || null,
          company_zip: companyZip?.trim() || null,
          type_stagiaire_bpf: typeStagiaireBpf || null,
          source_financement_bpf: sourceFinancementBpf || null,
          sold_price_ht: soldPriceHt ? parseFloat(String(soldPriceHt)) : null,
          payment_mode: paymentMode,
          sponsor_first_name: capitalizeName(sponsorFirstName || ""),
          sponsor_last_name: capitalizeName(sponsorLastName || ""),
          sponsor_email: sponsorEmail?.trim().toLowerCase() || null,
          financeur_same_as_sponsor: financeurSameAsSponsor,
          financeur_name: financeurSameAsSponsor ? null : (financeurName?.trim() || null),
          financeur_url: financeurSameAsSponsor ? null : (financeurUrl?.trim() || null),
        }),
      };

      const { data: draftParticipant, error: draftErr } = await admin
        .from("training_participants")
        .insert(draftRow)
        .select("id")
        .single();

      if (draftErr || !draftParticipant) {
        return new Response(
          JSON.stringify({ error: draftErr?.message ?? "Échec de la duplication" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true, participantId: (draftParticipant as { id: string }).id, draft: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = body.email.trim().toLowerCase();

    // Seule "e_learning" déclenche le flux d'accès LMS (pas classe_virtuelle).
    // classe_virtuelle → convocation classique (lien Zoom/Teams dans le mail).
    const isElearning = formatFormation === "e_learning";

    // Pour les ventes en ligne, le commanditaire est le participant lui-même.
    // Pour les e-learning en ajout manuel sans commanditaire renseigné,
    // on replie sur l'email du participant (le stagiaire paie souvent lui-même).
    const effectiveSponsorFirstName = paymentMode === "online" ? firstName : (sponsorFirstName || (isElearning ? firstName : null));
    const effectiveSponsorLastName = paymentMode === "online" ? lastName : (sponsorLastName || (isElearning ? lastName : null));
    const effectiveSponsorEmail = paymentMode === "online" ? email : (sponsorEmail || (isElearning ? email : null));

    // ── 1. Paramètres d'application ──────────────────────────────────────────
    const { data: settingsRows } = await admin
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "elearning_access_mode",
        "working_days",
        "delay_needs_survey_days",
        "delay_needs_survey_reminder_days",
        "delay_trainer_summary_days",
        "delay_reminder_days",
      ]);

    const getSetting = (k: string): string =>
      ((settingsRows ?? []) as Array<{ setting_key: string; setting_value: string }>)
        .find((s) => s.setting_key === k)?.setting_value ?? "";

    const elearningAccessMode =
      (getSetting("elearning_access_mode") as "magic_link" | "woocommerce") || "magic_link";
    const workingDaysArr = await fetchWorkingDays(admin);
    const needsSurveyDelay = parseInt(getSetting("delay_needs_survey_days") || "7", 10) || 7;
    const needsSurveyReminderDelay = parseInt(getSetting("delay_needs_survey_reminder_days") || "3", 10) || 3;
    const trainerSummaryDelay = parseInt(getSetting("delay_trainer_summary_days") || "1", 10) || 1;
    const reminderDelay = parseInt(getSetting("delay_reminder_days") || "7", 10) || 7;

    // ── 2. Mode email ────────────────────────────────────────────────────────
    const { status: emailStatus, sendWelcomeNow, ongoing } = computeEmailMode(
      trainingStartDate,
      trainingEndDate,
    );

    // Envoie la convocation si la formation n'est pas passée OU si elle est
    // en cours (mid-session add). Pour l'e-learning : envoi immédiat à l'inscription.
    const shouldSendWelcome =
      isElearning || emailStatus !== "non_envoye" || ongoing;

    // ── 3. Participant existant ? ────────────────────────────────────────────
    const { data: existing } = await admin
      .from("training_participants")
      .select("id")
      .eq("training_id", trainingId)
      .eq("email", email)
      .maybeSingle();

    const alreadyExisted = !!existing;
    let participantId: string;

    // Suivi des emails programmés (retourné au caller)
    let needsSurveyScheduled = false;
    let welcomeScheduled = false;

    if (alreadyExisted) {
      participantId = existing.id;
    } else {
      // ── 4. Insertion ───────────────────────────────────────────────────────
      const needsSurveyToken = crypto.randomUUID();

      const participantRow: Record<string, unknown> = {
        training_id: trainingId,
        email,
        first_name: capitalizeName(firstName),
        last_name: capitalizeName(lastName),
        company: company?.trim() || null,
        needs_survey_token: needsSurveyToken,
        needs_survey_status: emailStatus,
        coaching_sessions_total: coachingSessionsTotal,
        coaching_sessions_completed: 0,
        coaching_deadline: coachingDeadline || null,
        ...(formulaId && { formula: formulaName || null, formula_id: formulaId }),
        ...(notes && { notes }),
        ...(isInterEntreprise && {
          company_address: companyAddress?.trim() || null,
          company_city: companyCity?.trim() || null,
          company_zip: companyZip?.trim() || null,
          type_stagiaire_bpf: typeStagiaireBpf || null,
          source_financement_bpf: sourceFinancementBpf || null,
          sold_price_ht: soldPriceHt ? parseFloat(String(soldPriceHt)) : null,
          payment_mode: paymentMode,
          sponsor_first_name: capitalizeName(effectiveSponsorFirstName),
          sponsor_last_name: capitalizeName(effectiveSponsorLastName),
          sponsor_email: effectiveSponsorEmail?.trim().toLowerCase() || null,
          financeur_same_as_sponsor: paymentMode === "online" ? true : financeurSameAsSponsor,
          financeur_name: (paymentMode === "online" || financeurSameAsSponsor) ? null : (financeurName?.trim() || null),
          financeur_url: (paymentMode === "online" || financeurSameAsSponsor) ? null : (financeurUrl?.trim() || null),
        }),
      };

      const { data: participant, error: insertErr } = await admin
        .from("training_participants")
        .insert(participantRow)
        .select("id")
        .single();

      if (insertErr || !participant) {
        throw new Error(insertErr?.message ?? "Échec d'insertion du participant");
      }
      participantId = (participant as { id: string }).id;

      // ── 5. Questionnaire besoins ───────────────────────────────────────────
      try {
        await admin.from("questionnaire_besoins").insert({
          participant_id: participantId,
          training_id: trainingId,
          token: needsSurveyToken,
          etat: emailStatus,
          email,
          prenom: firstName?.trim() || null,
          nom: lastName?.trim() || null,
          societe: company?.trim() || null,
        });
      } catch (qErr) {
        console.warn("[add-training-participant] questionnaire_besoins:", qErr);
      }

      // ── 6. Programmation des emails ────────────────────────────────────────
      // Recueil des besoins : envoyé pour toutes les formations (y compris e-learning).
      // Pour e-learning ou sans date : envoi immédiat. Sinon : J-needsSurveyDelay.
      if (emailStatus !== "non_envoye" && !ongoing) {
        try {
          const now = new Date();
          let scheduledFor: string;
          if (isElearning || !trainingStartDate) {
            scheduledFor = now.toISOString();
          } else {
            const startDate = new Date(`${trainingStartDate}T00:00:00`);
            const surveyDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDaysArr);
            scheduledFor = surveyDate > now
              ? `${surveyDate.toISOString().split("T")[0]}T09:00:00`
              : now.toISOString();
          }
          await admin.from("scheduled_emails").insert({
            training_id: trainingId,
            participant_id: participantId,
            email_type: "needs_survey",
            scheduled_for: scheduledFor,
            status: "pending",
          });
          needsSurveyScheduled = true;
        } catch (err) {
          console.error("[add-training-participant] schedule needs_survey:", err);
        }
      }

      // Relance recueil des besoins : programmée pour toutes les formations
      // si la date de relance est encore future. La case force-send vérifiera
      // l'état du questionnaire avant envoi (skip si déjà complété).
      if (emailStatus !== "non_envoye" && !ongoing) {
        try {
          const now = new Date();
          const baseDate = (isElearning || !trainingStartDate)
            ? now
            : subtractWorkingDays(new Date(`${trainingStartDate}T00:00:00`), needsSurveyDelay, workingDaysArr);
          const reminderDate = addWorkingDays(baseDate, needsSurveyReminderDelay, workingDaysArr);
          if (reminderDate > now) {
            await admin.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: participantId,
              email_type: "needs_survey_reminder",
              scheduled_for: `${reminderDate.toISOString().split("T")[0]}T09:00:00`,
              status: "pending",
            });
          }
        } catch (err) {
          console.error("[add-training-participant] schedule needs_survey_reminder:", err);
        }
      }

      // Rappel "votre formation approche" : programmé pour toutes les formations
      // (y compris e-learning) à J-delay_reminder_days jours ouvrés, si la date
      // est encore future.
      if (trainingStartDate) {
        try {
          const startDate = new Date(`${trainingStartDate}T00:00:00`);
          const approachDate = subtractWorkingDays(startDate, reminderDelay, workingDaysArr);
          if (approachDate > new Date()) {
            await admin.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: participantId,
              email_type: "reminder",
              scheduled_for: `${approachDate.toISOString().split("T")[0]}T09:00:00`,
              status: "pending",
            });
          }
        } catch (err) {
          console.error("[add-training-participant] schedule reminder:", err);
        }
      }

      // Convocation J-7 : uniquement quand la formation est à plus de 7 j
      // (status "programme") et non e-learning.
      if (trainingStartDate && !isElearning && emailStatus === "programme") {
        try {
          const startDate = new Date(`${trainingStartDate}T00:00:00`);
          const welcomeDate = subtractWorkingDays(startDate, 7, workingDaysArr);
          if (welcomeDate > new Date()) {
            await admin.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: participantId,
              email_type: "welcome",
              scheduled_for: `${welcomeDate.toISOString().split("T")[0]}T09:00:00`,
              status: "pending",
            });
            welcomeScheduled = true;
          }
        } catch (err) {
          console.error("[add-training-participant] schedule welcome J-7:", err);
        }
      }
    }

    // ── 7. Récapitulatif formateur (une seule fois par session) ───────────────
    let trainerSummaryScheduled = false;
    if (trainingStartDate && emailStatus !== "non_envoye") {
      try {
        const { data: existingSummary } = await admin
          .from("scheduled_emails")
          .select("id")
          .eq("training_id", trainingId)
          .eq("email_type", "trainer_summary")
          .limit(1);
        if (!existingSummary || existingSummary.length === 0) {
          const startDate = new Date(`${trainingStartDate}T00:00:00`);
          const summaryDate = subtractWorkingDays(startDate, trainerSummaryDelay, workingDaysArr);
          if (summaryDate > new Date()) {
            await admin.from("scheduled_emails").insert({
              training_id: trainingId,
              email_type: "trainer_summary",
              scheduled_for: `${summaryDate.toISOString().split("T")[0]}T07:00:00`,
              status: "pending",
            });
            trainerSummaryScheduled = true;
          }
        }
      } catch (err) {
        console.error("[add-training-participant] schedule trainer_summary:", err);
      }
    }

    // ── 8. Convocation immédiate (formations J-2 à J-7 ou en cours) ───────────
    let welcomeSent = false;
    let welcomeFailed = false;
    const sendWelcomeImmediately =
      shouldSendWelcome && (sendWelcomeNow || ongoing || isElearning);
    if (sendWelcomeImmediately) {
      try {
        await admin.functions.invoke("send-welcome-email", {
          body: { participantId, trainingId },
        });
        welcomeSent = true;
      } catch (err) {
        console.error("[add-training-participant] send-welcome-email:", err);
        welcomeFailed = true;
      }
    }

    // ── 9. Rattrapage d'émargement (ajout en cours de formation) ─────────────
    let attendanceCatchUp: { sentSlots: number; errors: number } | null = null;
    if (ongoing && !isElearning) {
      try {
        const { data: sentRows } = await admin
          .from("attendance_signatures")
          .select("schedule_date, period")
          .eq("training_id", trainingId)
          .not("email_sent_at", "is", null);

        const uniqueSlots = Array.from(
          new Map(
            ((sentRows ?? []) as Array<{ schedule_date: string; period: string }>).map(
              (r) => [`${r.schedule_date}|${r.period}`, r],
            ),
          ).values(),
        );

        let sentSlots = 0;
        let errors = 0;
        for (const slot of uniqueSlots) {
          try {
            await admin.functions.invoke("send-attendance-signature-request", {
              body: {
                trainingId,
                scheduleDate: slot.schedule_date,
                period: slot.period,
                participantIds: [participantId],
              },
            });
            sentSlots++;
          } catch (slotErr) {
            console.error("[add-training-participant] catch-up slot:", slot, slotErr);
            errors++;
          }
        }
        attendanceCatchUp = { sentSlots, errors };
      } catch (err) {
        console.error("[add-training-participant] catch-up attendance:", err);
        attendanceCatchUp = { sentSlots: 0, errors: 1 };
      }
    }

    // ── 10. Accès e-learning ──────────────────────────────────────────────────
    // Toujours envoyé pour les formations e_learning, quelle que soit la source
    // (manuel ou webhook WooCommerce) et le mode de paiement.
    let elearningAccessSent = false;
    let couponGenerated = false;
    const shouldSendElearningAccess = isElearning;



    if (shouldSendElearningAccess) {
      if (elearningAccessMode === "magic_link") {
        try {
          await admin.functions.invoke("send-learner-magic-link", {
            body: { email, trainingId, participantId },
          });
          elearningAccessSent = true;
        } catch (err) {
          console.error("[add-training-participant] send-learner-magic-link:", err);
        }
      } else {
        let couponCode: string | undefined;
        if (generateCoupon) {
          try {
            const { data: couponData } = await admin.functions.invoke(
              "generate-woocommerce-coupon",
              { body: { participantId, trainingId } },
            );
            couponCode = couponData?.coupon_code;
            if (couponCode) couponGenerated = true;
          } catch (err) {
            console.error("[add-training-participant] generate-woocommerce-coupon:", err);
          }
        }
        try {
          await admin.functions.invoke("send-elearning-access", {
            body: { participantId, trainingId, couponCode },
          });
          elearningAccessSent = true;
        } catch (err) {
          console.error("[add-training-participant] send-elearning-access:", err);
        }
      }
    }

    // ── 11. Convention de formation (inter-entreprises uniquement) ───────────────
    // Générée automatiquement pour tout nouveau participant inter-entreprise.
    // Le PDF est stocké dans training_participants.convention_file_url.
    // Si un email sponsor est connu, la convention est envoyée pour signature en ligne.
    let conventionGenerated = false;
    let conventionEmailSent = false;
    if (isInterEntreprise && !alreadyExisted) {
      try {
        const { data: convData, error: convErr } = await admin.functions.invoke(
          "generate-convention-formation",
          { body: { trainingId, participantId, subrogation: false } },
        );
        if (convErr) {
          console.error("[add-training-participant] generate-convention-formation:", convErr);
        } else if (convData?.success && convData?.pdfUrl) {
          conventionGenerated = true;
          // Envoi pour signature si un email sponsor est disponible
          const normalizedSponsorEmail = effectiveSponsorEmail?.trim().toLowerCase() || null;
          if (normalizedSponsorEmail) {
            const recipientName = [effectiveSponsorFirstName, effectiveSponsorLastName]
              .map((s) => s?.trim())
              .filter(Boolean)
              .join(" ") || null;
            try {
              const { error: sendErr } = await admin.functions.invoke("send-convention-email", {
                body: {
                  trainingId,
                  conventionUrl: convData.pdfUrl,
                  recipientEmail: normalizedSponsorEmail,
                  ...(recipientName && { recipientName }),
                  ...(effectiveSponsorFirstName?.trim() && { recipientFirstName: effectiveSponsorFirstName.trim() }),
                  ...(convData.fileName && { conventionFileName: convData.fileName }),
                  enableOnlineSignature: true,
                  formalAddress: true,
                },
              });
              if (sendErr) {
                console.error("[add-training-participant] send-convention-email:", sendErr);
              } else {
                conventionEmailSent = true;
              }
            } catch (sendErr) {
              console.error("[add-training-participant] send-convention-email:", sendErr);
            }
          }
        }
      } catch (convErr) {
        console.error("[add-training-participant] generate-convention-formation:", convErr);
      }
    }

    // ── 12. Log d'activité ────────────────────────────────────────────────────
    const actionType =
      source === "woocommerce" ? "participant_added_from_woocommerce"
      : source === "bulk"      ? "participant_added_bulk"
      :                          "participant_added";

    try {
      await admin.from("activity_logs").insert({
        action_type: actionType,
        recipient_email: email,
        details: {
          training_id: trainingId,
          participant_id: participantId,
          ...(source === "woocommerce" && {
            woocommerce_order_id: woocommerceOrderId,
            woocommerce_product_id: woocommerceProductId,
            routing_reason: routingReason,
            is_elearning: isElearning,
            source: "woocommerce_webhook",
          }),
        },
      });
    } catch (logErr) {
      console.warn("[add-training-participant] activity_logs:", logErr);
    }

    const response: AddParticipantResponse = {
      participantId,
      alreadyExisted,
      status: emailStatus,
      ongoing,
      welcomeSent,
      welcomeFailed,
      welcomeScheduled,
      needsSurveyScheduled,
      trainerSummaryScheduled,
      attendanceCatchUp,
      elearningAccessSent,
      elearningMode: isElearning ? elearningAccessMode : null,
      couponGenerated,
      conventionGenerated,
      conventionEmailSent,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[add-training-participant] Unhandled error:", message);
    await reportEdgeError(err, { fn: "add-training-participant" });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
