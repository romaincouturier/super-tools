import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, PanelRightOpen, FileText, Save, Loader2 } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Session persistence helpers — survive tab switches & in-app navigation
// ---------------------------------------------------------------------------

interface WorkflowSessionState {
  step: QuoteWorkflowStep;
  completedSteps: number[];
  synthesis: string;
  instructions: string;
  loomUrl: string | null;
  challengeHtml: string;
  travelTotal: number;
  travelDestinations: TravelDestination[];
  travelSettings: TravelSettings | null;
  clientData: ClientData | null;
  quoteId: string | null;
  savedAt: number;
}

const SESSION_KEY_PREFIX = "quote-workflow-";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getSessionKey(cardId: string) {
  return `${SESSION_KEY_PREFIX}${cardId}`;
}

function loadSession(cardId: string): WorkflowSessionState | null {
  try {
    const raw = sessionStorage.getItem(getSessionKey(cardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkflowSessionState;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      sessionStorage.removeItem(getSessionKey(cardId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(cardId: string, state: WorkflowSessionState) {
  try {
    sessionStorage.setItem(getSessionKey(cardId), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // storage full — silently ignore
  }
}

function clearSession(cardId: string) {
  try {
    sessionStorage.removeItem(getSessionKey(cardId));
  } catch {}
}

// ---------------------------------------------------------------------------

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
    if (q.email_sent_at) return 5;
    if (q.client_siren) return 4;
    if (q.line_items?.length > 0) return 3;
    if ((q as any).travel_data?.total) return 2;
    if (q.loom_url) return 1;
    return 0;
  };

  const getInitialCompleted = (q: Quote | null | undefined): Set<number> => {
    if (!q) return new Set();
    const step = getInitialStep(q);
    const completed = new Set<number>();
    for (let i = 0; i < step; i++) completed.add(i);
    return completed;
  };

  // Try to restore from session first, then from existing quote
  const session = loadSession(crmCard.id);

  const [step, setStep] = useState<QuoteWorkflowStep>(
    session?.step ?? (existingQuoteId ? getInitialStep(existingQuote) : 0)
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    session ? new Set(session.completedSteps) : (existingQuoteId ? getInitialCompleted(existingQuote) : new Set())
  );
  const [clientData, setClientData] = useState<ClientData | null>(session?.clientData ?? null);
  const [synthesis, setSynthesis] = useState(session?.synthesis ?? "");
  const [instructions, setInstructions] = useState(session?.instructions ?? "");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loomUrl, setLoomUrl] = useState<string | null>(session?.loomUrl ?? null);
  const [challengeHtml, setChallengeHtml] = useState(session?.challengeHtml ?? "");

  // Travel state
  const [travelTotal, setTravelTotal] = useState(session?.travelTotal ?? 0);
  const [travelDestinations, setTravelDestinations] = useState<TravelDestination[]>(session?.travelDestinations ?? []);
  const [travelSettings, setTravelSettings] = useState<TravelSettings | null>(session?.travelSettings ?? null);

  // Track if session was already restored from quote (to avoid overriding session data)
  const restoredFromQuote = useRef(!!session);

  // Auto-persist to sessionStorage on every state change
  useEffect(() => {
    saveSession(crmCard.id, {
      step,
      completedSteps: Array.from(completedSteps),
      synthesis,
      instructions,
      loomUrl,
      challengeHtml,
      travelTotal,
      travelDestinations,
      travelSettings,
      clientData,
      quoteId: quote?.id ?? session?.quoteId ?? null,
      savedAt: Date.now(),
    });
  }, [step, completedSteps, synthesis, instructions, loomUrl, challengeHtml, travelTotal, travelDestinations, travelSettings, clientData, quote, crmCard.id]);

  // Update state when existing quote loads (only if not already restored from session)
  useEffect(() => {
    if (existingQuote && !quote && !restoredFromQuote.current) {
      restoredFromQuote.current = true;
      setQuote(existingQuote);
      if (existingQuote.synthesis) setSynthesis(existingQuote.synthesis);
      if (existingQuote.instructions) setInstructions(existingQuote.instructions);
      if (existingQuote.loom_url) setLoomUrl(existingQuote.loom_url);
      if ((existingQuote as any).challenge_html) setChallengeHtml((existingQuote as any).challenge_html);
      
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
    } else if (existingQuote && !quote) {
      // Session was restored but we still need the quote object
      setQuote(existingQuote);
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

  const handleChallengeChange = useCallback((html: string) => {
    setChallengeHtml(html);
    if (quote) {
      updateMutation.mutate({
        id: quote.id,
        updates: { challenge_html: html } as any,
      });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 0 → Synthèse complete, go to step 1 (Loom)
  const handleSynthesisValidated = async (s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    completeStep(0);
    saveWorkflowStep(quote?.id || "", 1, { synthesis: s, instructions: i });
    setStep(1);
  };

  // Step 1 → Loom complete, go to step 2 (Déplacements)
  const handleLoomContinue = async (url: string | null) => {
    setLoomUrl(url);
    completeStep(1);
    saveWorkflowStep(quote?.id || "", 2, url ? { loom_url: url } : {});
    setStep(2);
  };

  // Step 2 → Travel complete, go to step 3 (Client)
  const handleTravelContinue = async (total: number, destinations: TravelDestination[], settings: TravelSettings | null) => {
    setTravelTotal(total);
    setTravelDestinations(destinations);
    setTravelSettings(settings);
    completeStep(2);
    const travelData = { total, destinations, settings };
    saveWorkflowStep(quote?.id || "", 3, { travel_data: travelData });
    setStep(3);
  };

  // Step 3 → Client validated, create/update quote and go to step 4 (Devis)
  const handleClientValidated = async (client: ClientData) => {
    setClientData(client);
    completeStep(3);

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
      } catch (e: unknown) {
        toast.error("Erreur lors de la création du devis : " + (e instanceof Error ? e.message : "Erreur inconnue"));
        return;
      }
    } else {
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

    saveWorkflowStep(currentQuote!.id, 4);
    setStep(4);
  };

  // Step 4 → Quote complete, go to step 5 (Email)
  const handleQuoteContinue = async (updatedQuote: Quote) => {
    setQuote(updatedQuote);
    completeStep(4);
    saveWorkflowStep(updatedQuote.id, 5);
    setStep(5);
  };

  // Step 5 → Done
  const handleSent = () => {
    completeStep(5);
    clearSession(crmCard.id);
    toast.success("Devis envoyé avec succès !");
    navigate(`/crm/card/${crmCard.id}`);
  };

  // Back button handler
  const handleBack = () => {
    if (step > 0) {
      setStep((step - 1) as QuoteWorkflowStep);
    }
  };

  // Manual save handler
  const [isSaving, setIsSaving] = useState(false);

  if (existingQuoteId && loadingQuote) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      if (quote) {
        await updateMutation.mutateAsync({
          id: quote.id,
          updates: {
            synthesis,
            instructions,
            loom_url: loomUrl || null,
            workflow_step: step,
            ...(challengeHtml ? { challenge_html: challengeHtml } as any : {}),
            ...(travelDestinations.length > 0 ? { travel_data: { total: travelTotal, destinations: travelDestinations, settings: travelSettings } } : {}),
            ...(clientData ? {
              client_company: clientData.company,
              client_address: clientData.address,
              client_zip: clientData.zip,
              client_city: clientData.city,
              client_vat_number: clientData.vatNumber || null,
              client_siren: clientData.siren || null,
              client_email: clientData.email || null,
            } : {}),
          },
        });
        toast.success("Devis sauvegardé");
      } else {
        // Create a draft quote
        const newQuote = await createMutation.mutateAsync({
          crm_card_id: crmCard.id,
          client_company: clientData?.company || crmCard.company || "",
          client_address: clientData?.address || "",
          client_zip: clientData?.zip || "",
          client_city: clientData?.city || "",
          client_vat_number: clientData?.vatNumber || null,
          client_siren: clientData?.siren || null,
          client_email: clientData?.email || null,
        });
        setQuote(newQuote);
        // Save additional data
        await updateMutation.mutateAsync({
          id: newQuote.id,
          updates: {
            synthesis,
            instructions,
            loom_url: loomUrl || null,
            workflow_step: step,
            ...(challengeHtml ? { challenge_html: challengeHtml } as any : {}),
          },
        });
        toast.success("Brouillon de devis créé");
      }
    } catch (e: unknown) {
      toast.error("Erreur lors de la sauvegarde : " + (e instanceof Error ? e.message : "Erreur inconnue"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* Global toolbar: sidebar toggle + save button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {crmCard.description_html && (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                >
                  <PanelRightOpen className="w-4 h-4" />
                  Fiche opportunité
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[500px] sm:w-[700px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {crmCard.title}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {(clientData?.company || crmCard.company) && (
                      <span className="bg-muted px-2 py-0.5 rounded">{clientData?.company || crmCard.company}</span>
                    )}
                    {crmCard.service_type && <span className="bg-muted px-2 py-0.5 rounded">{crmCard.service_type}</span>}
                    {crmCard.estimated_value && <span className="bg-muted px-2 py-0.5 rounded">{crmCard.estimated_value} €</span>}
                  </div>
                  <div
                    className="text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: crmCard.description_html }}
                  />
                  {synthesis && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-sm mb-2">Synthèse générée</h3>
                      <div
                        className="text-sm leading-relaxed [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3:first-child]:mt-0 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-0.5 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: synthesis }}
                      />
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleManualSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder
        </Button>
      </div>

      <QuoteWorkflowStepper
        currentStep={step}
        completedSteps={completedSteps}
        onStepClick={(s) => {
          if (completedSteps.has(s) || s <= Math.max(...Array.from(completedSteps), -1) + 1) {
            setStep(s);
          }
        }}
      />

      {/* Step 0: Synthèse */}
      {step === 0 && (
        <Step1Synthesis
          crmCard={crmCard}
          clientCompany={clientData?.company || crmCard.company || ""}
          onValidate={handleSynthesisValidated}
          onDraftChange={handleDraftSynthesis}
          onChallengeChange={handleChallengeChange}
          initialSynthesis={synthesis}
          initialInstructions={instructions}
          initialChallengeHtml={challengeHtml}
        />
      )}

      {/* Step 1: Loom */}
      {step === 1 && (
        <>
          <BackButton onClick={handleBack} />
          <Step4Loom
            onContinue={handleLoomContinue}
            onDraftChange={handleDraftLoom}
            initialLoomUrl={loomUrl}
            crmCard={crmCard}
            quote={quote}
            synthesis={synthesis}
            instructions={instructions}
            challengeHtml={challengeHtml}
          />
        </>
      )}

      {/* Step 2: Déplacements */}
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

      {/* Step 3: Client */}
      {step === 3 && (
        <>
          <BackButton onClick={handleBack} />
          <Step0ClientValidation
            crmCard={crmCard}
            onValidate={handleClientValidated}
            initialClient={clientData}
          />
        </>
      )}

      {/* Step 4: Devis */}
      {step === 4 && quote && (
        <>
          <BackButton onClick={handleBack} />
          <Step3QuoteGeneration
            quote={quote}
            synthesis={synthesis}
            instructions={instructions}
            travelTotal={travelTotal}
            crmCard={crmCard}
            onContinue={handleQuoteContinue}
          />
        </>
      )}

      {/* Step 5: Email */}
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
