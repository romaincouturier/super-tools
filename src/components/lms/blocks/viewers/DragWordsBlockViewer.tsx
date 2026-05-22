import { useState, useMemo } from "react";
import type { DragWordsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: DragWordsBlockContent;
}

type Part = { type: "text" | "blank"; value: string };

function parseDragWords(text: string): Part[] {
  const parts: Part[] = [];
  const regex = /\*([^*]+)\*/g;
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

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function DragWordsBlockViewer({ content }: Props) {
  const parts = useMemo(() => parseDragWords(content.text ?? ""), [content.text]);
  const blanks = parts.filter((p) => p.type === "blank");
  const wordBank = useMemo(() => shuffle(blanks.map((b) => b.value)), [content.text]);
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  if (blanks.length === 0) return null;

  const usedWords = Object.values(placements);
  const availableWords = wordBank.filter((w) => !usedWords.includes(w));

  const placeWord = (blankIdx: number) => {
    if (!selectedWord) return;
    setPlacements((p) => ({ ...p, [blankIdx]: selectedWord }));
    setSelectedWord(null);
  };

  const removeFromBlank = (blankIdx: number) => {
    if (checked) return;
    setPlacements((p) => { const next = { ...p }; delete next[blankIdx]; return next; });
  };

  const check = () => setChecked(true);
  const reset = () => { setPlacements({}); setSelectedWord(null); setChecked(false); };

  let blankIdx = 0;
  const correctCount = checked
    ? blanks.filter((b, i) => placements[i] === b.value).length
    : 0;
  const allPlaced = Object.keys(placements).length === blanks.length;

  return (
    <div className="space-y-4">
      {content.title && (
        <p className="font-bold text-base" style={{ color: "#101820" }}>{content.title}</p>
      )}
      {content.instructions && (
        <p className="text-sm" style={{ color: "rgba(16,24,32,0.6)" }}>{content.instructions}</p>
      )}

      {/* Word bank */}
      <div
        className="flex flex-wrap gap-2 p-3 rounded-xl"
        style={{ background: "#F2F4F4", minHeight: 52 }}
      >
        {availableWords.map((word, i) => (
          <button
            key={word + i}
            type="button"
            onClick={() => setSelectedWord(selectedWord === word ? null : word)}
            style={{
              padding: "4px 14px",
              borderRadius: 20,
              border: `2px solid ${selectedWord === word ? "#FFD100" : "#e5e7eb"}`,
              background: selectedWord === word ? "#FFFBEA" : "#ffffff",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              cursor: "pointer",
              color: "#101820",
              fontWeight: selectedWord === word ? 700 : 400,
              transition: "all 0.15s",
            }}
          >
            {word}
          </button>
        ))}
        {availableWords.length === 0 && !checked && (
          <span style={{ fontSize: "0.8125rem", color: "rgba(16,24,32,0.4)", alignSelf: "center" }}>
            Tous les mots ont été placés
          </span>
        )}
      </div>

      {/* Text with blank slots */}
      <div className="text-base leading-[2.2]" style={{ color: "#101820" }}>
        {parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>;
          const idx = blankIdx++;
          const placed = placements[idx];
          const isCorrect = checked && placed === part.value;
          const isWrong = checked && placed && placed !== part.value;
          return (
            <span key={i} className="inline-flex items-center mx-0.5">
              <button
                type="button"
                disabled={checked}
                onClick={() => placed ? removeFromBlank(idx) : placeWord(idx)}
                style={{
                  minWidth: Math.max(80, part.value.length * 10 + 24),
                  padding: "3px 12px",
                  borderRadius: 20,
                  border: `2px solid ${isCorrect ? "#69c3c4" : isWrong ? "#ef4444" : placed ? "#FFD100" : selectedWord ? "rgba(255,209,0,0.6)" : "rgba(16,24,32,0.2)"}`,
                  background: isCorrect ? "rgba(105,195,196,0.1)" : isWrong ? "rgba(239,68,68,0.07)" : placed ? "#FFFBEA" : selectedWord ? "rgba(255,209,0,0.08)" : "#f9fafb",
                  fontFamily: "inherit",
                  fontSize: "0.875rem",
                  cursor: checked ? "default" : "pointer",
                  color: "#101820",
                  transition: "all 0.15s",
                  fontWeight: placed ? 600 : 400,
                }}
              >
                {placed ?? "___"}
              </button>
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
            disabled={!allPlaced}
            style={{
              padding: "0.5rem 1.25rem",
              background: allPlaced ? "#FFD100" : "#F2F4F4",
              color: allPlaced ? "#101820" : "rgba(16,24,32,0.4)",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "none",
              cursor: allPlaced ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
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
