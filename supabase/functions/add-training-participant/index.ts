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
import { fetchWorkingDays, subtractWorkingDays } from "../_shared/working-days.ts";

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
  // Options e-learning (ajout manuel uniquement)
  generateCoupon?: boolean;
  // Origine de l'ajout — utilisé pour le log d'activité et certaines règles
  source?: "manual" | "woocommerce" | "bulk" | "zapier";
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

    if (!trainingId || !body.email) {
      return new Response(
        JSON.stringify({ error: "trainingId et email sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = body.email.trim().toLowerCase();

    // Seule "e_learning" déclenche le flux d'accès LMS (pas classe_virtuelle).
    // classe_virtuelle → convocation classique (lien Zoom/Teams dans le mail).
    const isElearning = formatFormation === "e_learning";

    // ── 1. Paramètres d'application ──────────────────────────────────────────
    const { data: settingsRows } = await admin
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "elearning_access_mode",
        "working_days",
        "delay_needs_survey_days",
        "delay_trainer_summary_days",
      ]);

    const getSetting = (k: string): string =>
      ((settingsRows ?? []) as Array<{ setting_key: string; setting_value: string }>)
        .find((s) => s.setting_key === k)?.setting_value ?? "";

    const elearningAccessMode =
      (getSetting("elearning_access_mode") as "magic_link" | "woocommerce") || "magic_link";
    const workingDaysArr = await fetchWorkingDays(admin);
    const needsSurveyDelay = parseInt(getSetting("delay_needs_survey_days") || "7", 10) || 7;
    const trainerSummaryDelay = parseInt(getSetting("delay_trainer_summary_days") || "1", 10) || 1;

    // ── 2. Mode email ────────────────────────────────────────────────────────
    const { status: emailStatus, sendWelcomeNow, ongoing } = computeEmailMode(
      trainingStartDate,
      trainingEndDate,
    );

    // Envoie la convocation si la formation n'est pas passée OU si elle est
    // en cours (mid-session add) — sauf pour l'e-learning qui a son propre flux.
    const shouldSendWelcome =
      !isElearning && (emailStatus !== "non_envoye" || ongoing);

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
          sold_price_ht: soldPriceHt ? parseFloat(String(soldPriceHt)) : null,
          payment_mode: paymentMode,
          // Pour les ventes en ligne, le commanditaire est le participant lui-même
          sponsor_first_name: paymentMode === "online"
            ? capitalizeName(firstName)
            : capitalizeName(sponsorFirstName),
          sponsor_last_name: paymentMode === "online"
            ? capitalizeName(lastName)
            : capitalizeName(sponsorLastName),
          sponsor_email: paymentMode === "online"
            ? email
            : (sponsorEmail?.trim().toLowerCase() || null),
          financeur_same_as_sponsor: financeurSameAsSponsor,
          financeur_name: !financeurSameAsSponsor ? (financeurName?.trim() || null) : null,
          financeur_url: !financeurSameAsSponsor ? (financeurUrl?.trim() || null) : null,
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

      // ── 6. Programmation des emails pour les formations futures ────────────
      // Recueil des besoins : non-e-learning, futur, pas en cours
      if (trainingStartDate && !isElearning && emailStatus !== "non_envoye" && !ongoing) {
        try {
          const startDate = new Date(`${trainingStartDate}T00:00:00`);
          const surveyDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDaysArr);
          if (surveyDate > new Date()) {
            await admin.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: participantId,
              email_type: "needs_survey",
              scheduled_for: `${surveyDate.toISOString().split("T")[0]}T09:00:00`,
              status: "pending",
            });
            needsSurveyScheduled = true;
          }
        } catch (err) {
          console.error("[add-training-participant] schedule needs_survey:", err);
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
    if (shouldSendWelcome && sendWelcomeNow) {
      try {
        await admin.functions.invoke("send-welcome-email", {
          body: { participantId, trainingId },
        });
        welcomeSent = true;
      } catch (err) {
        console.error("[add-training-participant] send-welcome-email:", err);
        welcomeFailed = true;
      }
    } else if (shouldSendWelcome && ongoing) {
      // Ajout mid-session : la convocation classique n'a pas encore été envoyée
      // (status === "non_envoye") mais on envoie quand même car la formation
      // est encore en cours.
      try {
        await admin.functions.invoke("send-welcome-email", {
          body: { participantId, trainingId },
        });
        welcomeSent = true;
      } catch (err) {
        console.error("[add-training-participant] send-welcome-email (ongoing):", err);
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
    // Envoyé si : format e_learning ET (source WooCommerce OU paiement non-online).
    // Cas exclu : ajout manuel d'un participant ayant déjà payé via WooCommerce
    // (paymentMode "online") — il a reçu son accès côté WooCommerce.
    let elearningAccessSent = false;
    let couponGenerated = false;
    const shouldSendElearningAccess = isElearning && (source === "woocommerce" || paymentMode !== "online");

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
          const normalizedSponsorEmail = sponsorEmail?.trim().toLowerCase() || null;
          if (normalizedSponsorEmail) {
            const recipientName = [sponsorFirstName, sponsorLastName]
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
                  ...(sponsorFirstName?.trim() && { recipientFirstName: sponsorFirstName.trim() }),
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
      : source === "zapier"    ? "participant_added_from_zapier"
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
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
