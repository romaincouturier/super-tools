import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TimelineBlockContent, TimelineStep } from "@/types/lms-blocks";

interface Props {
  content: TimelineBlockContent;
}

const GRID_COLS = [
  "grid-cols-1",
  "grid-cols-2",
  "grid-cols-3",
  "grid-cols-4",
  "grid-cols-5",
];

export default function TimelineBlockViewer({ content }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const steps = content.steps ?? [];
  const accent = content.accent_color || "#FFD100";
  if (steps.length === 0) return null;

  const gridClass = GRID_COLS[Math.min(steps.length, 5) - 1];

  return (
    <div className="w-full">
      {/* Numbers row with connecting dotted lines */}
      <div className="flex items-center mb-4 px-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            {i > 0 && (
              <div className="flex-1 h-px border-t-2 border-dotted border-gray-300 mx-1" />
            )}
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
              style={{ background: openIdx === i ? accent : "#f3f4f6", color: "#101820" }}
            >
              {i + 1}
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px border-t-2 border-dotted border-gray-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className={`grid gap-3 ${gridClass}`}>
        {steps.map((step, i) => {
          const isOpen = openIdx === i;
          const hasPanelItems = (step.panel_items?.length ?? 0) > 0;
          return (
            <div key={step.id} className="flex flex-col">
              <StepCard
                step={step}
                isOpen={isOpen}
                accent={accent}
                hasPanelItems={hasPanelItems}
                onToggle={() => setOpenIdx(isOpen ? null : i)}
              />
              {isOpen && hasPanelItems && (
                <div className="mt-0">
                  <div className="flex justify-center">
                    <div
                      className="w-0 h-0"
                      style={{
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderBottom: `8px solid ${accent}`,
                      }}
                    />
                  </div>
                  <div
                    className="rounded-xl border-2 p-4"
                    style={{ borderColor: accent, backgroundColor: "#fffef5" }}
                  >
                    {step.panel_title && (
                      <p className="font-bold text-sm mb-3">{step.panel_title}</p>
                    )}
                    <ul className="space-y-2">
                      {step.panel_items!.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                          {item.icon_url ? (
                            <img src={item.icon_url} alt="" className="w-5 h-5 object-contain shrink-0" />
                          ) : (
                            <span className="w-5 h-5 shrink-0 rounded bg-gray-100 flex items-center justify-center">
                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                            </span>
                          )}
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepCard({
  step,
  isOpen,
  accent,
  hasPanelItems,
  onToggle,
}: {
  step: TimelineStep;
  isOpen: boolean;
  accent: string;
  hasPanelItems: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlight = isOpen || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center text-center rounded-2xl border-2 p-4 transition-colors"
      style={{
        borderColor: highlight ? accent : "#e5e7eb",
        backgroundColor: isOpen ? "#fffef5" : "#ffffff",
      }}
    >
      {step.icon_url && (
        <img src={step.icon_url} alt="" className="w-12 h-12 object-contain mb-3" />
      )}
      <p className="font-bold text-sm leading-snug mb-1">{step.title}</p>
      {step.description && (
        <p className="text-xs text-gray-500 leading-snug">{step.description}</p>
      )}
      {hasPanelItems && (
        <button
          className="mt-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ background: isOpen ? accent : "#f3f4f6" }}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label={isOpen ? "Fermer l'encart" : "Voir les exemples"}
        >
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
    </div>
  );
}
