import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import Step0ClientValidation, { type ClientData } from "./Step0ClientValidation";
import Step1Synthesis from "./Step1Synthesis";
import Step3QuoteGeneration from "./Step3QuoteGeneration";
import Step4Loom from "./Step4Loom";
import Step5Email from "./Step5Email";
import { useCreateQuote, useUpdateQuote, useQuote } from "@/hooks/useQuotes";
import type { CrmCard } from "@/types/crm";
import type { Quote, QuoteWorkflowStep } from "@/types/quotes";
import { Loader2 } from "lucide-react";

interface Props {
  crmCard: CrmCard;
  existingQuoteId?: string;
}

export default function QuoteWorkflow({ crmCard, existingQuoteId }: Props) {
  const navigate = useNavigate();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();
  const { data: existingQuote, isLoading: loadingQuote } = useQuote(existingQuoteId);

  const [step, setStep] = useState<QuoteWorkflowStep>(existingQuoteId ? 2 : 0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    existingQuoteId ? new Set([0, 1]) : new Set()
  );
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [synthesis, setSynthesis] = useState("");
  const [instructions, setInstructions] = useState("");
  const [quote, setQuote] = useState<Quote | null>(existingQuote || null);
  const [loomUrl, setLoomUrl] = useState<string | null>(null);

  // Update quote when loaded
  if (existingQuote && !quote) {
    setQuote(existingQuote);
    if (existingQuote.synthesis) setSynthesis(existingQuote.synthesis);
    if (existingQuote.instructions) setInstructions(existingQuote.instructions);
    if (existingQuote.loom_url) setLoomUrl(existingQuote.loom_url);
  }

  const completeStep = useCallback(
    (s: number) => setCompletedSteps((prev) => new Set([...prev, s])),
    []
  );

  // Step 0 → Create quote and go to step 1
  const handleClientValidated = async (client: ClientData) => {
    setClientData(client);
    completeStep(0);

    if (!quote) {
      try {
        const newQuote = await createMutation.mutateAsync({
          crm_card_id: crmCard.id,
          client_company: client.company,
          client_address: client.address,
          client_zip: client.zip,
          client_city: client.city,
          client_vat_number: client.vatNumber || null,
          client_siren: client.siren || null,
          client_email: client.email || null,
        });
        setQuote(newQuote);
      } catch (e: any) {
        toast.error("Erreur lors de la création du devis : " + e.message);
        return;
      }
    }

    setStep(1);
  };

  // Step 1 → Save synthesis + instructions, go to step 2
  const handleSynthesisValidated = async (s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    completeStep(1);

    if (quote) {
      await updateMutation.mutateAsync({
        id: quote.id,
        updates: { synthesis: s, instructions: i },
      });
    }

    setStep(2);
  };

  // Step 2 → Go to step 3
  const handleQuoteContinue = (updatedQuote: Quote) => {
    setQuote(updatedQuote);
    completeStep(2);
    setStep(3);
  };

  // Step 3 → Save loom, go to step 4
  const handleLoomContinue = async (url: string | null) => {
    setLoomUrl(url);
    completeStep(3);

    if (quote && url) {
      await updateMutation.mutateAsync({
        id: quote.id,
        updates: { loom_url: url },
      });
    }

    setStep(4);
  };

  // Step 4 → Done
  const handleSent = () => {
    completeStep(4);
    toast.success("Devis envoyé avec succès !");
    navigate(`/crm/card/${crmCard.id}`);
  };

  if (existingQuoteId && loadingQuote) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <QuoteWorkflowStepper
        currentStep={step}
        completedSteps={completedSteps}
        onStepClick={(s) => {
          if (completedSteps.has(s) || s <= Math.max(...Array.from(completedSteps), -1) + 1) {
            setStep(s);
          }
        }}
      />

      {step === 0 && (
        <Step0ClientValidation
          crmCard={crmCard}
          onValidate={handleClientValidated}
        />
      )}

      {step === 1 && (
        <Step1Synthesis
          crmCard={crmCard}
          clientCompany={clientData?.company || crmCard.company || ""}
          onValidate={handleSynthesisValidated}
          initialSynthesis={synthesis}
          initialInstructions={instructions}
        />
      )}

      {step === 2 && quote && (
        <Step3QuoteGeneration
          quote={quote}
          synthesis={synthesis}
          instructions={instructions}
          onContinue={handleQuoteContinue}
        />
      )}

      {step === 3 && (
        <Step4Loom
          onContinue={handleLoomContinue}
          initialLoomUrl={loomUrl}
        />
      )}

      {step === 4 && quote && (
        <Step5Email
          quote={quote}
          synthesis={synthesis}
          loomUrl={loomUrl}
          clientEmail={clientData?.email || quote.client_email || ""}
          clientCompany={clientData?.company || quote.client_company}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
