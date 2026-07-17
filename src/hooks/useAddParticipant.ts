import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { FormationFormula } from "@/types/training";
import type { AddParticipantResponse } from "@/types/addParticipant";

export interface AddParticipantParams {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  companyAddress: string;
  companyZip: string;
  companyCity: string;
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
  typeStagiaireBpf: string;
  sourceFinancementBpf: string;
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
      const coachingSessionsTotal = params.selectedFormula?.coaching_sessions_count || 0;
      const coachingDeadline =
        coachingSessionsTotal > 0
          ? (() => {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              return format(d, "yyyy-MM-dd");
            })()
          : null;

      const { data, error } = await supabase.functions.invoke<AddParticipantResponse>(
        "add-training-participant",
        {
          body: {
            trainingId,
            trainingStartDate: trainingStartDate ?? null,
            trainingEndDate: trainingEndDate ?? null,
            formatFormation: formatFormation ?? null,
            isInterEntreprise,
            email: params.email,
            firstName: params.firstName,
            lastName: params.lastName,
            company: params.company,
            companyAddress: params.companyAddress || null,
            companyZip: params.companyZip || null,
            companyCity: params.companyCity || null,
            typeStagiaireBpf: params.typeStagiaireBpf || null,
            sourceFinancementBpf: params.sourceFinancementBpf || null,
            soldPriceHt: params.soldPriceHt ? parseFloat(params.soldPriceHt) : null,
            paymentMode: params.paymentMode,
            formulaId: params.formulaId || null,
            formulaName: params.formulaName || null,
            coachingSessionsTotal,
            coachingDeadline,
            sponsorFirstName: params.sponsorFirstName,
            sponsorLastName: params.sponsorLastName,
            sponsorEmail: params.sponsorEmail,
            financeurSameAsSponsor: params.financeurSameAsSponsor,
            financeurName: params.financeurName,
            financeurUrl: params.financeurUrl,
            source: "manual",
          },
        },
      );

      if (error) throw error;
      if (!data) throw new Error("Pas de réponse de add-training-participant");

      return {
        ...data,
        // Contexte nécessaire au toast (non retourné par l'edge function)
        email: params.email,
        formulaName: params.formulaName,
        formatFormation,
        paymentMode: params.paymentMode,
      };
    },

    onSuccess: (result) => {
      let statusMessage = "";

      if (result.formatFormation === "e_learning" && result.paymentMode !== "online") {
        const parts = [];
        if (result.formulaName) parts.push(`Formule ${result.formulaName}`);
        if (result.elearningMode === "magic_link") {
          parts.push("lien magique d'accès envoyé");
        } else {
          parts.push("email d'accès envoyé");
        }
        statusMessage = parts.join(", ") + ".";
      } else if (result.ongoing) {
        const parts: string[] = [];
        if (result.welcomeSent) parts.push("mail d'accueil envoyé (formation en cours)");
        else if (result.welcomeFailed) parts.push("⚠️ mail d'accueil en erreur");
        const catchUp = result.attendanceCatchUp;
        if (catchUp && catchUp.sentSlots > 0) {
          parts.push(
            `${catchUp.sentSlots} demande${catchUp.sentSlots > 1 ? "s" : ""} d'émargement rattrapée${catchUp.sentSlots > 1 ? "s" : ""}`,
          );
        }
        statusMessage = parts.length > 0 ? parts.join(", ") + "." : "Formation en cours.";
      } else if (result.formulaName) {
        statusMessage = `Formule ${result.formulaName}.`;
      } else if (result.status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (!result.needsSurveyScheduled) {
        statusMessage =
          "Mail de convocation envoyé. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else {
        statusMessage = "Mail de convocation envoyé, recueil des besoins programmé.";
      }

      // Suffix convention status
      if (result.conventionGenerated) {
        const convSuffix = result.conventionEmailSent
          ? " Convention générée et envoyée pour signature."
          : " Convention générée (pas d'email sponsor).";
        statusMessage = statusMessage.replace(/\.$/, "") + convSuffix;
      }

      const isWarn =
        !result.needsSurveyScheduled && result.status !== "non_envoye" && !result.ongoing
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
