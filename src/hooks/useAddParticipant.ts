import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
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
import type { FormationFormula } from "@/types/training";

export interface AddParticipantParams {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  formulaId: string;
  formulaName: string;
  selectedFormula: FormationFormula | undefined;
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  financeurSameAsSponsor: boolean;
  financeurName: string;
  financeurUrl: string;
  paymentMode: "online" | "invoice";
  soldPriceHt: string;
  generateCoupon: boolean;
}

interface UseAddParticipantOptions {
  trainingId: string;
  trainingStartDate?: string;
  trainingEndDate?: string | null;
  formatFormation?: string | null;
  isInterEntreprise: boolean;
  onSuccess: () => void;
  onScheduledEmailsRefresh?: () => void;
}

export function useAddParticipant({
  trainingId,
  trainingStartDate,
  trainingEndDate,
  formatFormation,
  isInterEntreprise,
  onSuccess,
  onScheduledEmailsRefresh,
}: UseAddParticipantOptions) {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (params: AddParticipantParams) => {
      const token = crypto.randomUUID();
      const { status, sendWelcomeNow } = getEmailMode(trainingStartDate);
      const ongoing = isTrainingOngoing(trainingStartDate, trainingEndDate);
      console.log("[useAddParticipant] Submit - status:", status, "sendWelcomeNow:", sendWelcomeNow, "ongoing:", ongoing);

      // Compute coaching fields from selected formula
      const coachingTotal = params.selectedFormula?.coaching_sessions_count || 0;
      const coachingDeadline =
        coachingTotal > 0
          ? (() => {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              return format(d, "yyyy-MM-dd");
            })()
          : null;

      // 1. Create participant
      const insertedParticipant = await createParticipant({
        trainingId,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        company: params.company,
        token,
        status,
        formulaId: params.formulaId,
        formulaName: params.formulaName,
        coachingTotal,
        coachingDeadline,
        isInterEntreprise,
        sponsorFirstName: params.sponsorFirstName,
        sponsorLastName: params.sponsorLastName,
        sponsorEmail: params.sponsorEmail,
        financeurSameAsSponsor: params.financeurSameAsSponsor,
        financeurName: params.financeurName,
        financeurUrl: params.financeurUrl,
        paymentMode: params.paymentMode,
        soldPriceHt: params.soldPriceHt,
      });

      // 2. Send welcome email immediately. Skip e-learning (separate flow) and
      // fully-past trainings. For an ongoing training (start_date ≤ today ≤ end_date),
      // a mid-session add still needs the welcome email — it carries the classe virtuelle
      // link, logistics, etc.
      const shouldSendWelcome = !!insertedParticipant
        && formatFormation !== "e_learning"
        && (status !== "non_envoye" || ongoing);
      let welcomeFailed = false;
      if (shouldSendWelcome) {
        try {
          await sendParticipantWelcomeEmail(insertedParticipant.id, trainingId);
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          welcomeFailed = true;
        }
      }

      // 2b. Mid-session catch-up : if the attendance signature request has
      // already been sent for at least one slot of this training, send it to
      // the new participant too (other participants are not re-emailed).
      let attendanceCatchUp: { sentSlots: number; errors: number } | null = null;
      if (ongoing && insertedParticipant && formatFormation !== "e_learning") {
        try {
          attendanceCatchUp = await catchUpAttendanceSignaturesForParticipant(
            trainingId,
            insertedParticipant.id,
          );
        } catch (catchUpErr) {
          console.error("Failed attendance catch-up:", catchUpErr);
          attendanceCatchUp = { sentSlots: 0, errors: 1 };
        }
      }

      // 3. For e-learning: generate coupon if needed, then send access email
      if (formatFormation === "e_learning" && params.paymentMode !== "online" && insertedParticipant) {
        let couponCode: string | undefined;

        if (params.generateCoupon) {
          try {
            const result = await generateWoocommerceCoupon(insertedParticipant.id, trainingId);
            if (result.error) {
              toast({
                title: "Coupon non généré",
                description:
                  "Le participant a été ajouté mais le coupon WooCommerce n'a pas pu être créé. Vérifiez la configuration WooCommerce.",
                variant: "default",
                duration: 8000,
              });
            } else if (result.couponCode) {
              couponCode = result.couponCode;
            }
          } catch (couponErr) {
            console.error("Failed to generate WooCommerce coupon:", couponErr);
          }
        }

        try {
          await sendElearningAccess(insertedParticipant.id, trainingId, couponCode);
        } catch (emailError) {
          console.error("Failed to send e-learning access email:", emailError);
        }
      }

      // 4. Schedule needs survey email for future trainings (skip for e-learning
      // and mid-session adds — the survey makes no sense once the session started)
      let needsSurveySkipped = false;
      const trainingInFuture = status !== "non_envoye" && !ongoing;
      if (trainingInFuture && insertedParticipant && trainingStartDate && formatFormation !== "e_learning") {
        try {
          const scheduled = await scheduleParticipantEmail(
            trainingId,
            insertedParticipant.id,
            trainingStartDate,
          );
          needsSurveySkipped = !scheduled;
        } catch (scheduleError) {
          console.error("Failed to schedule needs survey email:", scheduleError);
        }
      }

      // 5. Schedule trainer summary email if not already scheduled
      if (trainingStartDate && status !== "non_envoye") {
        await scheduleTrainerSummary(trainingId, trainingStartDate);
      }

      // 6. Log activity
      await logParticipantActivity(
        trainingId,
        params.email,
        params.firstName,
        params.lastName,
        params.company,
      );

      return {
        email: params.email,
        formulaName: params.formulaName,
        status,
        ongoing,
        sendWelcomeNow,
        welcomeSent: shouldSendWelcome && !welcomeFailed,
        welcomeFailed,
        needsSurveySkipped,
        attendanceCatchUp,
        formatFormation,
        paymentMode: params.paymentMode,
        generateCoupon: params.generateCoupon,
      };
    },
    onSuccess: (result) => {
      let statusMessage = "";
      if (result.formatFormation === "e_learning" && result.paymentMode !== "online") {
        const parts = [];
        if (result.formulaName) parts.push(`Formule ${result.formulaName}`);
        if (result.generateCoupon) parts.push("coupon WooCommerce généré");
        parts.push("email d'accès envoyé");
        statusMessage = parts.join(", ") + ".";
      } else if (result.ongoing) {
        const parts: string[] = [];
        if (result.welcomeSent) parts.push("mail d'accueil envoyé (formation en cours)");
        else if (result.welcomeFailed) parts.push("⚠️ mail d'accueil en erreur");
        if (result.attendanceCatchUp && result.attendanceCatchUp.sentSlots > 0) {
          parts.push(`${result.attendanceCatchUp.sentSlots} demande${result.attendanceCatchUp.sentSlots > 1 ? "s" : ""} d'émargement rattrapée${result.attendanceCatchUp.sentSlots > 1 ? "s" : ""}`);
        }
        statusMessage = parts.length > 0 ? parts.join(", ") + "." : "Formation en cours.";
      } else if (result.formulaName) {
        statusMessage = `Formule ${result.formulaName}.`;
      } else if (result.status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (result.needsSurveySkipped) {
        statusMessage =
          "Mail de convocation envoyé. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else if (result.status === "programme") {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      } else {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      }

      const isWarn = result.needsSurveySkipped
        || result.welcomeFailed
        || (result.attendanceCatchUp?.errors ?? 0) > 0;

      toast({
        title: "Participant ajouté",
        description: `${result.email} a été ajouté. ${statusMessage}`,
        ...(isWarn && { variant: "default" as const, duration: 8000 }),
      });

      onSuccess();
      if (onScheduledEmailsRefresh) {
        onScheduledEmailsRefresh();
      }
    },
    onError: (error: unknown) => {
      // Handle duplicate participant
      const err = error as { code?: string; message?: string };
      if (err?.code === "23505") {
        toast({
          title: "Participant déjà inscrit",
          description: "Un participant avec cet email est déjà inscrit à cette formation.",
          variant: "destructive",
        });
      } else {
        console.error("Error adding participant:", error);
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Une erreur est survenue.",
          variant: "destructive",
        });
      }
    },
  });

  return mutation;
}
