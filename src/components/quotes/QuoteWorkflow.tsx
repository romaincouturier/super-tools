import { useState, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, PanelRightOpen, FileText, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import Step0ClientValidation from "./Step0ClientValidation";
import Step1Synthesis from "./Step1Synthesis";
import StepTravelExpenses from "./StepTravelExpenses";
import Step3QuoteGeneration from "./Step3QuoteGeneration";
import Step4Loom from "./Step4Loom";
import Step5Email from "./Step5Email";
import { useQuoteWorkflow } from "@/hooks/useQuoteWorkflow";
import type { CrmCard } from "@/types/crm";

// ---------------------------------------------------------------------------
// Resizable sidebar helpers
// ---------------------------------------------------------------------------

const SIDEBAR_WIDTH_KEY = "quote-sidebar-width";
const SIDEBAR_MIN = 400;
const SIDEBAR_MAX = 900;
const SIDEBAR_DEFAULT = 700;

function loadSidebarWidth(): number {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (v) {
      const n = Number(v);
      if (n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n;
    }
  } catch {}
  return SIDEBAR_DEFAULT;
}

function saveSidebarWidth(w: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  } catch {}
}

// ---------------------------------------------------------------------------

interface Props {
  crmCard: CrmCard;
  existingQuoteId?: string;
}

export default function QuoteWorkflow({ crmCard, existingQuoteId }: Props) {
  const wf = useQuoteWorkflow(crmCard, existingQuoteId);

  // ---- Resizable sidebar ----
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const isDragging = useRef(false);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const sheetEl = (e.target as HTMLElement).closest("[data-sidebar-panel]") as HTMLElement | null;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, window.innerWidth - ev.clientX));
      if (sheetEl) sheetEl.style.width = `${newWidth}px`;
    };

    const onMouseUp = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const finalWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, window.innerWidth - ev.clientX));
      setSidebarWidth(finalWidth);
      saveSidebarWidth(finalWidth);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  if (wf.loadingQuote) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Global toolbar: sidebar toggle + save button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {crmCard.description_html && (
            <Sheet onOpenChange={(open) => { if (!open) saveSidebarWidth(sidebarWidth); }}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PanelRightOpen className="w-4 h-4" />
                  Fiche opportunité
                </Button>
              </SheetTrigger>
              <SheetContent
                className="overflow-y-auto !max-w-none"
                style={{ width: sidebarWidth }}
                data-sidebar-panel
              >
                {/* Resize drag handle on left edge */}
                <div
                  onMouseDown={handleResizeMouseDown}
                  className="absolute top-0 left-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary/30 transition-colors z-50"
                />
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {crmCard.title}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {(wf.clientData?.company || crmCard.company) && (
                      <span className="bg-muted px-2 py-0.5 rounded">{wf.clientData?.company || crmCard.company}</span>
                    )}
                    {crmCard.service_type && <span className="bg-muted px-2 py-0.5 rounded">{crmCard.service_type}</span>}
                    {crmCard.estimated_value && <span className="bg-muted px-2 py-0.5 rounded">{crmCard.estimated_value} €</span>}
                  </div>
                  <div
                    className="text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(crmCard.description_html) }}
                  />
                  {wf.synthesis && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-sm mb-2">Synthèse générée</h3>
                      <div
                        className="text-sm leading-relaxed [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3:first-child]:mt-0 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-0.5 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(wf.synthesis) }}
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
          onClick={wf.handleManualSave}
          disabled={wf.isSaving}
        >
          {wf.isSaving ? <Spinner /> : <Save className="w-4 h-4" />}
          Sauvegarder
        </Button>
      </div>

      <QuoteWorkflowStepper
        currentStep={wf.step}
        completedSteps={wf.completedSteps}
        onStepClick={(s) => {
          if (wf.completedSteps.has(s) || s <= Math.max(...Array.from(wf.completedSteps), -1) + 1) {
            wf.setStep(s);
          }
        }}
      />

      {/* Step 0: Synthèse */}
      {wf.step === 0 && (
        <Step1Synthesis
          crmCard={crmCard}
          clientCompany={wf.clientData?.company || crmCard.company || ""}
          onValidate={wf.handleSynthesisValidated}
          onDraftChange={wf.handleDraftSynthesis}
          onChallengeChange={wf.handleChallengeChange}
          initialSynthesis={wf.synthesis}
          initialInstructions={wf.instructions}
          initialChallengeHtml={wf.challengeHtml}
        />
      )}

      {/* Step 1: Loom */}
      {wf.step === 1 && (
        <>
          <BackButton onClick={wf.handleBack} />
          <Step4Loom
            onContinue={wf.handleLoomContinue}
            onDraftChange={wf.handleDraftLoom}
            onScriptChange={wf.handleDraftLoomScript}
            initialLoomUrl={wf.loomUrl}
            initialScript={wf.loomScript}
            crmCard={crmCard}
            quote={wf.quote}
            synthesis={wf.synthesis}
            instructions={wf.instructions}
            challengeHtml={wf.challengeHtml}
          />
        </>
      )}

      {/* Step 2: Déplacements */}
      {wf.step === 2 && (
        <>
          <BackButton onClick={wf.handleBack} />
          <StepTravelExpenses
            onContinue={wf.handleTravelContinue}
            initialTotal={wf.travelTotal}
            initialDestinations={wf.travelDestinations}
            initialSettings={wf.travelSettings}
          />
        </>
      )}

      {/* Step 3: Client */}
      {wf.step === 3 && (
        <>
          <BackButton onClick={wf.handleBack} />
          <Step0ClientValidation
            crmCard={crmCard}
            onValidate={wf.handleClientValidated}
            initialClient={wf.clientData}
          />
        </>
      )}

      {/* Step 4: Devis */}
      {wf.step === 4 && wf.quote && (
        <>
          <BackButton onClick={wf.handleBack} />
          <Step3QuoteGeneration
            quote={wf.quote}
            synthesis={wf.synthesis}
            instructions={wf.instructions}
            travelTotal={wf.travelTotal}
            crmCard={crmCard}
            challengeHtml={wf.challengeHtml}
            onContinue={wf.handleQuoteContinue}
            onChallengeChange={wf.handleChallengeChange}
          />
        </>
      )}

      {/* Step 5: Email */}
      {wf.step === 5 && wf.quote && (
        <>
          <BackButton onClick={wf.handleBack} />
          <Step5Email
            quote={wf.quote}
            synthesis={wf.synthesis}
            loomUrl={wf.loomUrl}
            clientEmail={wf.clientData?.email || wf.quote.client_email || ""}
            clientCompany={wf.clientData?.company || wf.quote.client_company}
            onSent={wf.handleSent}
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
