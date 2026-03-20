import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateQuote, useUpdateQuote, useQuote } from "@/hooks/useQuotes";
import { fetchQuotesByCard } from "@/services/quotes";
import { getErrorMessage } from "@/lib/error-utils";
import type { CrmCard } from "@/types/crm";
import type { Quote, QuoteWorkflowStep } from "@/types/quotes";
import type { ClientData } from "@/components/quotes/Step0ClientValidation";
import type { TravelDestination, TravelSettings } from "@/components/crm/TravelExpenseCalculator";

// ---------------------------------------------------------------------------
// Session persistence — survive tab switches & in-app navigation
// ---------------------------------------------------------------------------

interface WorkflowSessionState {
  step: QuoteWorkflowStep;
  completedSteps: number[];
  synthesis: string;
  instructions: string;
  loomUrl: string | null;
  loomScript: string;
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
// Helpers
// ---------------------------------------------------------------------------

function getInitialStep(q: Quote | null | undefined): QuoteWorkflowStep {
  if (!q) return 0;
  const saved = (q as unknown as { workflow_step?: number }).workflow_step;
  if (typeof saved === "number" && saved >= 0 && saved <= 5) return saved as QuoteWorkflowStep;
  if (q.email_sent_at) return 5;
  if (q.client_siren) return 4;
  if (q.line_items?.length > 0) return 3;
  if ((q as unknown as { travel_data?: { total?: number } }).travel_data?.total) return 2;
  if (q.loom_url) return 1;
  return 0;
}

function getInitialCompleted(q: Quote | null | undefined): Set<number> {
  if (!q) return new Set();
  const step = getInitialStep(q);
  const completed = new Set<number>();
  for (let i = 0; i < step; i++) completed.add(i);
  return completed;
}

/** Restore workflow state from a quote — used both for existing quote load and draft recovery */
function extractQuoteState(q: Quote) {
  return {
    synthesis: q.synthesis || "",
    instructions: q.instructions || "",
    loomUrl: q.loom_url || null,
    loomScript: (q as any).loom_script || "",
    challengeHtml: (q as any).challenge_html || "",
    travelTotal: (q as any).travel_data?.total || 0,
    travelDestinations: ((q as any).travel_data?.destinations || []) as TravelDestination[],
    travelSettings: ((q as any).travel_data?.settings || null) as TravelSettings | null,
    clientData: q.client_company
      ? {
          company: q.client_company,
          address: q.client_address,
          zip: q.client_zip,
          city: q.client_city,
          vatNumber: q.client_vat_number || "",
          siren: q.client_siren || "",
          email: q.client_email || "",
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuoteWorkflow(crmCard: CrmCard, existingQuoteId?: string) {
  const navigate = useNavigate();
  const createMutation = useCreateQuote();
  const updateMutation = useUpdateQuote();

  // Resolve effective quote ID: URL param > session > none
  const sessionSnapshot = loadSession(crmCard.id);
  const effectiveQuoteId = existingQuoteId || sessionSnapshot?.quoteId || undefined;
  const { data: existingQuote, isLoading: loadingQuote } = useQuote(effectiveQuoteId);

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
  const [loomScript, setLoomScript] = useState(session?.loomScript ?? "");
  const [challengeHtml, setChallengeHtml] = useState(session?.challengeHtml ?? "");

  // Travel state
  const [travelTotal, setTravelTotal] = useState(session?.travelTotal ?? 0);
  const [travelDestinations, setTravelDestinations] = useState<TravelDestination[]>(session?.travelDestinations ?? []);
  const [travelSettings, setTravelSettings] = useState<TravelSettings | null>(session?.travelSettings ?? null);

  // Track if session was already restored from quote
  const restoredFromQuote = useRef(!!session);

  // Manual save state
  const [isSaving, setIsSaving] = useState(false);

  // ---- Session auto-persist ----
  useEffect(() => {
    saveSession(crmCard.id, {
      step,
      completedSteps: Array.from(completedSteps),
      synthesis,
      instructions,
      loomUrl,
      loomScript,
      challengeHtml,
      travelTotal,
      travelDestinations,
      travelSettings,
      clientData,
      quoteId: quote?.id ?? session?.quoteId ?? null,
      savedAt: Date.now(),
    });
  }, [step, completedSteps, synthesis, instructions, loomUrl, loomScript, challengeHtml, travelTotal, travelDestinations, travelSettings, clientData, quote, crmCard.id]);

  // ---- Restore from existing quote ----
  useEffect(() => {
    if (existingQuote && !quote && !restoredFromQuote.current) {
      restoredFromQuote.current = true;
      setQuote(existingQuote);
      const restored = extractQuoteState(existingQuote);
      if (restored.synthesis) setSynthesis(restored.synthesis);
      if (restored.instructions) setInstructions(restored.instructions);
      if (restored.loomUrl) setLoomUrl(restored.loomUrl);
      if (restored.loomScript) setLoomScript(restored.loomScript);
      if (restored.challengeHtml) setChallengeHtml(restored.challengeHtml);
      if (restored.travelTotal) setTravelTotal(restored.travelTotal);
      if (restored.travelDestinations.length > 0) setTravelDestinations(restored.travelDestinations);
      if (restored.travelSettings) setTravelSettings(restored.travelSettings);
      if (restored.clientData) setClientData(restored.clientData);

      const savedStep = getInitialStep(existingQuote);
      setStep(savedStep);
      setCompletedSteps(getInitialCompleted(existingQuote));
    } else if (existingQuote && !quote) {
      setQuote(existingQuote);
    }
  }, [existingQuote]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Auto-create / find draft on mount ----
  const draftInitRef = useRef(false);

  useEffect(() => {
    if (effectiveQuoteId || quote || draftInitRef.current) return;
    draftInitRef.current = true;

    (async () => {
      try {
        const cardQuotes = await fetchQuotesByCard(crmCard.id);
        const draft = cardQuotes.find((q) => q.status === "draft");

        if (draft) {
          setQuote(draft);
          if (!session) {
            const restored = extractQuoteState(draft);
            if (restored.synthesis) setSynthesis(restored.synthesis);
            if (restored.instructions) setInstructions(restored.instructions);
            if (restored.loomUrl) setLoomUrl(restored.loomUrl);
            if (restored.loomScript) setLoomScript(restored.loomScript);
            if (restored.challengeHtml) setChallengeHtml(restored.challengeHtml);
            if (restored.travelTotal) setTravelTotal(restored.travelTotal);
            if (restored.travelDestinations.length > 0) setTravelDestinations(restored.travelDestinations);
            if (restored.travelSettings) setTravelSettings(restored.travelSettings);
            if (restored.clientData) setClientData(restored.clientData);
            const savedStep = getInitialStep(draft);
            if (savedStep > 0) {
              setStep(savedStep);
              setCompletedSteps(getInitialCompleted(draft));
            }
          }
          return;
        }

        const newQuote = await createMutation.mutateAsync({
          crm_card_id: crmCard.id,
          client_company: crmCard.company || "",
          client_address: "",
          client_zip: "",
          client_city: "",
        });
        setQuote(newQuote);
      } catch (e) {
        console.warn("Could not initialise draft quote:", e);
      }
    })();
  }, [effectiveQuoteId, quote]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Step helpers ----
  const completeStep = useCallback(
    (s: number) => setCompletedSteps((prev) => new Set([...prev, s])),
    []
  );

  const saveWorkflowStep = async (quoteId: string, stepNum: number, extraUpdates?: Record<string, unknown>) => {
    try {
      await updateMutation.mutateAsync({
        id: quoteId,
        updates: { ...extraUpdates, workflow_step: stepNum },
      });
    } catch (e) {
      console.warn("Could not save workflow step:", e);
    }
  };

  // ---- Auto-save handlers ----
  const handleDraftSynthesis = useCallback((s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    if (quote) {
      updateMutation.mutate({ id: quote.id, updates: { synthesis: s, instructions: i } });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDraftLoom = useCallback((url: string) => {
    setLoomUrl(url);
    if (quote) {
      updateMutation.mutate({ id: quote.id, updates: { loom_url: url } });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDraftLoomScript = useCallback((script: string) => {
    setLoomScript(script);
    if (quote) {
      updateMutation.mutate({ id: quote.id, updates: { loom_script: script } });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChallengeChange = useCallback((html: string) => {
    setChallengeHtml(html);
    if (quote) {
      updateMutation.mutate({ id: quote.id, updates: { challenge_html: html } });
    }
  }, [quote]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save travel data (debounced)
  const travelSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!quote || travelDestinations.length === 0) return;
    clearTimeout(travelSaveTimer.current);
    travelSaveTimer.current = setTimeout(() => {
      updateMutation.mutate({
        id: quote.id,
        updates: { travel_data: { total: travelTotal, destinations: travelDestinations, settings: travelSettings } },
      });
    }, 2000);
    return () => clearTimeout(travelSaveTimer.current);
  }, [travelTotal, travelDestinations, travelSettings, quote?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Step transition handlers ----
  const handleSynthesisValidated = async (s: string, i: string) => {
    setSynthesis(s);
    setInstructions(i);
    completeStep(0);
    saveWorkflowStep(quote?.id || "", 1, { synthesis: s, instructions: i });
    setStep(1);
  };

  const handleLoomContinue = async (url: string | null) => {
    setLoomUrl(url);
    completeStep(1);
    saveWorkflowStep(quote?.id || "", 2, {
      ...(url ? { loom_url: url } : {}),
      ...(loomScript ? { loom_script: loomScript } : {}),
    });
    setStep(2);
  };

  const handleTravelContinue = async (total: number, destinations: TravelDestination[], settings: TravelSettings | null) => {
    setTravelTotal(total);
    setTravelDestinations(destinations);
    setTravelSettings(settings);
    completeStep(2);
    const travelData = { total, destinations, settings };
    saveWorkflowStep(quote?.id || "", 3, { travel_data: travelData });
    setStep(3);
  };

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
        toast.error("Erreur lors de la création du devis : " + getErrorMessage(e));
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

  const handleQuoteContinue = async (updatedQuote: Quote) => {
    setQuote(updatedQuote);
    completeStep(4);
    saveWorkflowStep(updatedQuote.id, 5);
    setStep(5);
  };

  const handleSent = () => {
    completeStep(5);
    clearSession(crmCard.id);
    toast.success("Devis envoyé avec succès !");
    navigate(`/crm/card/${crmCard.id}`);
  };

  const handleBack = () => {
    if (step > 0) setStep((step - 1) as QuoteWorkflowStep);
  };

  // ---- Manual save ----
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
            loom_script: loomScript || null,
            workflow_step: step,
            ...(challengeHtml ? { challenge_html: challengeHtml } : {}),
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
        await updateMutation.mutateAsync({
          id: newQuote.id,
          updates: {
            synthesis,
            instructions,
            loom_url: loomUrl || null,
            loom_script: loomScript || null,
            workflow_step: step,
            ...(challengeHtml ? { challenge_html: challengeHtml } : {}),
          },
        });
        toast.success("Brouillon de devis créé");
      }
    } catch (e: unknown) {
      toast.error("Erreur lors de la sauvegarde : " + getErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    // State
    step,
    completedSteps,
    clientData,
    synthesis,
    instructions,
    quote,
    loomUrl,
    loomScript,
    challengeHtml,
    travelTotal,
    travelDestinations,
    travelSettings,
    isSaving,
    loadingQuote: !!(existingQuoteId && loadingQuote),

    // Step navigation
    setStep,
    handleBack,

    // Step handlers
    handleSynthesisValidated,
    handleLoomContinue,
    handleTravelContinue,
    handleClientValidated,
    handleQuoteContinue,
    handleSent,

    // Draft handlers
    handleDraftSynthesis,
    handleDraftLoom,
    handleDraftLoomScript,
    handleChallengeChange,
    handleManualSave,
  };
}
