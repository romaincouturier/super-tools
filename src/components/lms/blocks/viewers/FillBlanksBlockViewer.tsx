import { useState } from "react";
import type { FillBlanksBlockContent } from "@/types/lms-blocks";

interface Props {
  content: FillBlanksBlockContent;
}

type Part = { type: "text" | "blank"; value: string };

function parseBlanks(text: string): Part[] {
  const parts: Part[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", value: text.slice(last, match.index) });
    parts.push({ type: "blank", value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export default function FillBlanksBlockViewer({ content }: Props) {
  const parts = parseBlanks(content.text ?? "");
  const blanks = parts.filter((p) => p.type === "blank");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  if (blanks.length === 0) return null;

  let blankIdx = 0;
  const correctCount = checked
    ? blanks.filter((b, i) => answers[i]?.trim().toLowerCase() === b.value.trim().toLowerCase()).length
    : 0;

  const check = () => setChecked(true);
  const reset = () => { setAnswers({}); setChecked(false); };

  return (
    <div className="space-y-4">
      {content.title && (
        <p className="font-bold text-base" style={{ color: "#101820" }}>{content.title}</p>
      )}
      {content.instructions && (
        <p className="text-sm" style={{ color: "rgba(16,24,32,0.6)" }}>{content.instructions}</p>
      )}

      <div className="text-base leading-[2.2]" style={{ color: "#101820" }}>
        {parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>;
          const idx = blankIdx++;
          const val = answers[idx] ?? "";
          const isCorrect = checked && val.trim().toLowerCase() === part.value.trim().toLowerCase();
          const isWrong = checked && val.trim() !== "" && !isCorrect;
          return (
            <span key={i} className="inline-flex items-center mx-0.5">
              <input
                type="text"
                value={val}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                disabled={checked}
                style={{
                  border: `2px solid ${isCorrect ? "#69c3c4" : isWrong ? "#ef4444" : "rgba(16,24,32,0.2)"}`,
                  borderRadius: 6,
                  padding: "1px 8px",
                  fontSize: "0.9375rem",
                  fontFamily: "inherit",
                  width: Math.max(80, part.value.length * 11 + 24),
                  background: isCorrect ? "rgba(105,195,196,0.1)" : isWrong ? "rgba(239,68,68,0.07)" : "#fff",
                  outline: "none",
                  color: "#101820",
                  lineHeight: 1.6,
                }}
              />
              {isWrong && (
                <span className="ml-1 text-xs font-semibold" style={{ color: "#69c3c4" }}>{part.value}</span>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {!checked ? (
          <button
            onClick={check}
            style={{ padding: "0.5rem 1.25rem", background: "#FFD100", color: "#101820", borderRadius: 10, fontWeight: 700, fontSize: "0.875rem", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Vérifier
          </button>
        ) : (
          <>
            <div className="text-sm font-semibold" style={{ color: correctCount === blanks.length ? "#69c3c4" : "#101820" }}>
              {correctCount} / {blanks.length} correct{correctCount > 1 ? "s" : ""}
            </div>
            <button
              onClick={reset}
              style={{ padding: "0.5rem 1.25rem", background: "transparent", color: "#101820", borderRadius: 10, fontWeight: 600, fontSize: "0.875rem", border: "1px solid rgba(16,24,32,0.2)", cursor: "pointer", fontFamily: "inherit" }}
            >
              Recommencer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
