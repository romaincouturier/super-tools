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
} from "@/services/participants";
import { getEmailMode } from "@/lib/emailScheduling";
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
  formatFormation?: string | null;
  isInterEntreprise: boolean;
  onSuccess: () => void;
  onScheduledEmailsRefresh?: () => void;
}

export function useAddParticipant({
  trainingId,
  trainingStartDate,
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
      console.log("[useAddParticipant] Submit - status:", status, "sendWelcomeNow:", sendWelcomeNow);

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

      // 2. Send welcome email (skip for e-learning)
      if (sendWelcomeNow && insertedParticipant && formatFormation !== "e_learning") {
        try {
          await sendParticipantWelcomeEmail(insertedParticipant.id, trainingId);
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
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

      // 4. Schedule needs survey email for future trainings (skip for e-learning)
      let needsSurveySkipped = false;
      if (sendWelcomeNow && insertedParticipant && trainingStartDate && formatFormation !== "e_learning") {
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
        sendWelcomeNow,
        needsSurveySkipped,
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
      } else if (result.formulaName) {
        statusMessage = `Formule ${result.formulaName}.`;
      } else if (result.status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (result.sendWelcomeNow && result.needsSurveySkipped) {
        statusMessage =
          "Mail de convocation envoyé. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else if (result.sendWelcomeNow) {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      }

      toast({
        title: "Participant ajouté",
        description: `${result.email} a été ajouté. ${statusMessage}`,
        ...(result.needsSurveySkipped && { variant: "default" as const, duration: 8000 }),
      });

      onSuccess();
      if (onScheduledEmailsRefresh) {
        onScheduledEmailsRefresh();
      }
    },
    onError: (error: any) => {
      // Handle duplicate participant
      if (error?.code === "23505") {
        toast({
          title: "Participant déjà inscrit",
          description: "Un participant avec cet email est déjà inscrit à cette formation.",
          variant: "destructive",
        });
      } else {
        console.error("Error adding participant:", error);
        toast({
          title: "Erreur",
          description: error.message || "Une erreur est survenue.",
          variant: "destructive",
        });
      }
    },
  });

  return mutation;
}
