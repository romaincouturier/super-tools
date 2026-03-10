import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import Step0ClientValidation, { type ClientData } from "./Step0ClientValidation";
import Step1Synthesis from "./Step1Synthesis";
import StepTravelExpenses from "./StepTravelExpenses";
import Step3QuoteGeneration from "./Step3QuoteGeneration";
import Step4Loom from "./Step4Loom";
import Step5Email from "./Step5Email";
import { useCreateQuote, useUpdateQuote, useQuote } from "@/hooks/useQuotes";
import type { CrmCard } from "@/types/crm";
import type { Quote, QuoteWorkflowStep } from "@/types/quotes";
import type { TravelDestination, TravelSettings } from "@/components/crm/TravelExpenseCalculator";
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

  // Determine initial step from existing quote
  const getInitialStep = (q: Quote | null | undefined): QuoteWorkflowStep => {
    if (!q) return 0;
    const saved = (q as any).workflow_step;
    if (typeof saved === "number" && saved >= 0 && saved <= 5) return saved as QuoteWorkflowStep;
    // Fallback: infer from data
    if (q.email_sent_at) return 5;
    if (q.loom_url) return 4;
    if (q.line_items?.length > 0) return 3;
    if (q.synthesis) return 1;
    return 0;
  };

  const getInitialCompleted = (q: Quote | null | undefined): Set<number> => {
    if (!q) return new Set();
    const step = getInitialStep(q);
    const completed = new Set<number>();
    for (let i = 0; i < step; i++) completed.add(i);
    return completed;
  };

  const [step, setStep] = useState<QuoteWorkflowStep>(
    existingQuoteId ? getInitialStep(existingQuote) : 0
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    existingQuoteId ? getInitialCompleted(existingQuote) : new Set()
  );
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [synthesis, setSynthesis] = useState("");
  const [instructions, setInstructions] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loomUrl, setLoomUrl] = useState<string | null>(null);

  // Travel state
  const [travelTotal, setTravelTotal] = useState(0);
  const [travelDestinations, setTravelDestinations] = useState<TravelDestination[]>([]);
  const [travelSettings, setTravelSettings] = useState<TravelSettings | null>(null);

  // Update state when existing quote loads
  useEffect(() => {
    if (existingQuote && !quote) {
      setQuote(existingQuote);
      if (existingQuote.synthesis) setSynthesis(existingQuote.synthesis);
      if (existingQuote.instructions) setInstructions(existingQuote.instructions);
      if (existingQuote.loom_url) setLoomUrl(existingQuote.loom_url);
      
      // Restore travel data
      const td = (existingQuote as any).travel_data;
      if (td) {
        setTravelTotal(td.total || 0);
        setTravelDestinations(td.destinations || []);
        setTravelSettings(td.settings || null);
      }

      // Restore client data from quote
      setClientData({
        company: existingQuote.client_company,
        address: existingQuote.client_address,
        zip: existingQuote.client_zip,
        city: existingQuote.client_city,
        vatNumber: existingQuote.client_vat_number || "",
        siren: existingQuote.client_siren || "",
        email: existingQuote.client_email || "",
      });

      // Set step and completed
      const savedStep = getInitialStep(existingQuote);
      setStep(savedStep);
      setCompletedSteps(getInitialCompleted(existingQuote));
    }
  }, [existingQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  const completeStep = useCallback(
    (s: number) => setCompletedSteps((prev) => new Set([...prev, s])),
    []
  );

  // Save workflow step to DB
  const saveWorkflowStep = async (quoteId: string, stepNum: number, extraUpdates?: Record<string, any>) => {
    try {
      await updateMutation.mutateAsync({
        id: quoteId,
        updates: { ...extraUpdates, workflow_step: stepNum },
      });
    } catch (e) {
      console.warn("Could not save workflow step:", e);
    }
  };

  // Auto-save draft data (debounced by the child components)
  const handleDraftSynthesis = useCallback((s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    if (quote) {
      updateMutation.mutate({
        id: quote.id,
        updates: { synthesis: s, instructions: i },
      });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDraftLoom = useCallback((url: string) => {
    setLoomUrl(url);
    if (quote) {
      updateMutation.mutate({
        id: quote.id,
        updates: { loom_url: url },
      });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 0 → Create quote and go to step 1
  const handleClientValidated = async (client: ClientData) => {
    setClientData(client);
    completeStep(0);

    let currentQuote = quote;
    if (!currentQuote) {
      try {
        currentQuote = await createMutation.mutateAsync({
          crm_card_id: crmCard.id,
          client_company: client.company,
          client_address: client.address,
          client_zip: client.zip,
          client_city: client.city,
          client_vat_number: client.vatNumber || null,
          client_siren: client.siren || null,
          client_email: client.email || null,
        });
        setQuote(currentQuote);
      } catch (e: any) {
        toast.error("Erreur lors de la création du devis : " + e.message);
        return;
      }
    } else {
      // Update client info
      await updateMutation.mutateAsync({
        id: currentQuote.id,
        updates: {
          client_company: client.company,
          client_address: client.address,
          client_zip: client.zip,
          client_city: client.city,
          client_vat_number: client.vatNumber || null,
          client_siren: client.siren || null,
          client_email: client.email || null,
        },
      });
    }

    saveWorkflowStep(currentQuote!.id, 1);
    setStep(1);
  };

  // Step 1 → Save synthesis + instructions, go to step 2
  const handleSynthesisValidated = async (s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    completeStep(1);

    if (quote) {
      await saveWorkflowStep(quote.id, 2, { synthesis: s, instructions: i });
    }

    setStep(2);
  };

  // Step 2 → Travel expenses, go to step 3
  const handleTravelContinue = async (total: number, destinations: TravelDestination[], settings: TravelSettings | null) => {
    setTravelTotal(total);
    setTravelDestinations(destinations);
    setTravelSettings(settings);
    completeStep(2);

    if (quote) {
      const travelData = { total, destinations, settings };
      await saveWorkflowStep(quote.id, 3, { travel_data: travelData });
    }

    setStep(3);
  };

  // Step 3 → Go to step 4
  const handleQuoteContinue = async (updatedQuote: Quote) => {
    setQuote(updatedQuote);
    completeStep(3);
    saveWorkflowStep(updatedQuote.id, 4);
    setStep(4);
  };

  // Step 4 → Save loom, go to step 5
  const handleLoomContinue = async (url: string | null) => {
    setLoomUrl(url);
    completeStep(4);

    if (quote) {
      await saveWorkflowStep(quote.id, 5, url ? { loom_url: url } : {});
    }

    setStep(5);
  };

  // Step 5 → Done
  const handleSent = () => {
    completeStep(5);
    toast.success("Devis envoyé avec succès !");
    navigate(`/crm/card/${crmCard.id}`);
  };

  // Back button handler
  const handleBack = () => {
    if (step > 0) {
      setStep((step - 1) as QuoteWorkflowStep);
    }
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
        <>
          <BackButton onClick={handleBack} />
          <Step1Synthesis
            crmCard={crmCard}
            clientCompany={clientData?.company || crmCard.company || ""}
            onValidate={handleSynthesisValidated}
            onDraftChange={handleDraftSynthesis}
            initialSynthesis={synthesis}
            initialInstructions={instructions}
          />
        </>
      )}

      {step === 2 && (
        <>
          <BackButton onClick={handleBack} />
          <StepTravelExpenses
            onContinue={handleTravelContinue}
            initialTotal={travelTotal}
            initialDestinations={travelDestinations}
            initialSettings={travelSettings}
          />
        </>
      )}

      {step === 3 && quote && (
        <>
          <BackButton onClick={handleBack} />
          <Step3QuoteGeneration
            quote={quote}
            synthesis={synthesis}
            instructions={instructions}
            travelTotal={travelTotal}
            onContinue={handleQuoteContinue}
          />
        </>
      )}

      {step === 4 && (
        <>
          <BackButton onClick={handleBack} />
          <Step4Loom
            onContinue={handleLoomContinue}
            initialLoomUrl={loomUrl}
          />
        </>
      )}

      {step === 5 && quote && (
        <>
          <BackButton onClick={handleBack} />
          <Step5Email
            quote={quote}
            synthesis={synthesis}
            loomUrl={loomUrl}
            clientEmail={clientData?.email || quote.client_email || ""}
            clientCompany={clientData?.company || quote.client_company}
            onSent={handleSent}
          />
        </>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="mb-4 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="w-4 h-4" />
      Étape précédente
    </Button>
  );
}
