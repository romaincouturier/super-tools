import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { QuoteWorkflowStep } from "@/types/quotes";

const STEPS: { label: string; description: string }[] = [
  { label: "Synthèse", description: "Analyse IA + Challenge" },
  { label: "Loom", description: "Vidéo (optionnel)" },
  { label: "Déplacements", description: "Frais de route" },
  { label: "Client", description: "Validation SIREN" },
  { label: "Devis", description: "Génération PDF" },
  { label: "Email", description: "Envoi final" },
];

interface Props {
  currentStep: QuoteWorkflowStep;
  onStepClick?: (step: QuoteWorkflowStep) => void;
  completedSteps: Set<number>;
}

export default function QuoteWorkflowStepper({
  currentStep,
  onStepClick,
  completedSteps,
}: Props) {
  return (
    <nav className="flex items-center justify-between mb-8">
      {STEPS.map((step, i) => {
        const isCompleted = completedSteps.has(i);
        const isCurrent = currentStep === i;
        const isClickable =
          onStepClick && (isCompleted || i <= Math.max(...Array.from(completedSteps), -1) + 1);

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick?.(i as QuoteWorkflowStep)}
              className={cn(
                "flex flex-col items-center gap-1 group",
                isClickable && "cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : i}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground hidden lg:block">
                {step.description}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
