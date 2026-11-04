import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { SummaryBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SummaryBlockContent;
}

export default function SummaryBlockViewer({ content }: Props) {
  const statements = content.statements ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);

  if (statements.length === 0) return null;

  const correctStatements = statements.filter((s) => s.is_correct);

  const toggle = (id: string) => {
    if (checked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const correctSelected = checked
    ? correctStatements.filter((s) => selected.has(s.id)).length
    : 0;
  const wrongSelected = checked
    ? statements.filter((s) => !s.is_correct && selected.has(s.id)).length
    : 0;

  const check = () => setChecked(true);
  const reset = () => { setSelected(new Set()); setChecked(false); };

  return (
    <div className="space-y-4">
      {content.title && (
        <p className="font-bold text-base" style={{ color: "hsl(var(--ink))" }}>{content.title}</p>
      )}
      {content.instructions && (
        <p className="text-sm" style={{ color: "hsl(var(--ink) / 0.6)" }}>{content.instructions}</p>
      )}

      <div className="space-y-2">
        {statements.map((stmt) => {
          const isSelected = selected.has(stmt.id);
          const isCorrectlySelected = checked && stmt.is_correct && isSelected;
          const isMissed = checked && stmt.is_correct && !isSelected;
          const isWronglySelected = checked && !stmt.is_correct && isSelected;

          return (
            <button
              key={stmt.id}
              type="button"
              disabled={checked}
              onClick={() => toggle(stmt.id)}
              className="w-full flex items-center gap-3 text-left"
              style={{
                padding: "0.75rem 1rem",
                borderRadius: 10,
                border: `1.5px solid ${
                  isCorrectlySelected ? "#69c3c4"
                  : isWronglySelected ? "#ef4444"
                  : isMissed ? "rgba(105,195,196,0.5)"
                  : isSelected ? "#FFD100"
                  : "#e5e7eb"
                }`,
                background: isCorrectlySelected
                  ? "rgba(105,195,196,0.08)"
                  : isWronglySelected
                  ? "rgba(239,68,68,0.04)"
                  : isMissed
                  ? "rgba(105,195,196,0.04)"
                  : isSelected
                  ? "#FFFBEA"
                  : "#ffffff",
                cursor: checked ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${isSelected ? "hsl(var(--yellow-brand))" : "hsl(var(--border))"}`,
                  background: isSelected ? "hsl(var(--yellow-brand))" : "#fff",
                  flexShrink: 0,
                }}
              />
              <span className="flex-1 text-sm" style={{ color: "hsl(var(--ink))" }}>{stmt.text}</span>
              {checked && (isCorrectlySelected || isMissed) && (
                <CheckCircle2 size={16} style={{ color: "#69c3c4", flexShrink: 0 }} />
              )}
              {checked && isWronglySelected && (
                <XCircle size={16} style={{ color: "hsl(var(--feedback-danger))", flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {!checked ? (
          <button
            onClick={check}
            style={{ padding: "0.5rem 1.25rem", background: "hsl(var(--yellow-brand))", color: "hsl(var(--ink))", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Vérifier
          </button>
        ) : (
          <>
            <div className="text-sm font-semibold" style={{ color: wrongSelected === 0 && correctSelected === correctStatements.length ? "#69c3c4" : "hsl(var(--ink))" }}>
              {correctSelected}/{correctStatements.length} bonne{correctStatements.length > 1 ? "s" : ""} réponse{correctStatements.length > 1 ? "s" : ""}
              {wrongSelected > 0 && ` — ${wrongSelected} erreur${wrongSelected > 1 ? "s" : ""}`}
            </div>
            <button
              onClick={reset}
              style={{ padding: "0.5rem 1.25rem", background: "transparent", color: "hsl(var(--ink))", borderRadius: 10, fontWeight: 600, fontSize: "0.875rem", border: "1px solid hsl(var(--ink) / 0.2)", cursor: "pointer", fontFamily: "inherit" }}
            >
              Recommencer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
