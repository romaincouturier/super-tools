import { useId, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineBlockContent } from "@/types/lms-blocks";

const GRID_COLS = ["grid-cols-1", "grid-cols-1 sm:grid-cols-2", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"];

export default function TimelineBlockViewer({ content }: { content: TimelineBlockContent }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const panelId = useId();
  const steps = content.steps ?? [];
  const active = steps.find((step) => step.id === activeId) ?? steps[0];
  if (!active) return null;
  return (
    <div className="w-full space-y-4 text-foreground" style={{ "--timeline-accent": content.accent_color || "hsl(var(--accent))" } as CSSProperties}>
      <div className={cn("grid min-w-0 gap-3", GRID_COLS[Math.min(steps.length, 5) - 1])}>
        {steps.map((step, i) => {
          const selected = active.id === step.id;
          return <Button key={step.id} type="button" variant="outline" aria-expanded={selected} aria-controls={panelId}
            onClick={(e) => { e.stopPropagation(); setActiveId(step.id); }}
            className={cn("h-auto min-w-0 flex-col whitespace-normal border-2 p-4 text-center text-foreground hover:bg-muted", selected && "border-[var(--timeline-accent)] bg-card ring-2 ring-[var(--timeline-accent)] ring-offset-2 ring-offset-background")}>
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold", selected ? "bg-[var(--timeline-accent)] text-primary-foreground" : "bg-muted text-foreground")}>{i + 1}</span>
            {step.icon_url && <img src={step.icon_url} alt="" className="h-14 w-14 shrink-0 object-contain" />}
            <span className="w-full break-words text-xl font-bold leading-snug">{step.title}</span>
            <ChevronDown aria-hidden="true" className={cn("h-5 w-5 transition-transform motion-reduce:transition-none", selected && "rotate-180")} />
          </Button>;
        })}
      </div>
      <section id={panelId} aria-label={active.panel_title || active.title} className="rounded-lg border-2 border-[var(--timeline-accent)] bg-card p-5" aria-live="polite">
        <h3 className="mb-2 break-words text-xl font-bold">{active.panel_title || active.title}</h3>
        {active.description && <p className="whitespace-pre-line break-words text-[1.05rem] leading-relaxed text-foreground">{active.description}</p>}
        {!!active.panel_items?.length && <ul className="mt-4 space-y-3">
          {active.panel_items.map((item) => <li key={item.id} className="flex items-start gap-3 text-base leading-relaxed">
            {item.icon_url ? <img src={item.icon_url} alt="" className="h-6 w-6 shrink-0 object-contain" /> : <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--timeline-accent)]" />}
            <span className="min-w-0 break-words">{item.label}</span>
          </li>)}
        </ul>}
      </section>
    </div>
  );
}
