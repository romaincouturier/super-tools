import { useMemo } from "react";
import { Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { tokenizeCodeLines, codeLanguageLabel, type CodeTokenType } from "@/lib/codeHighlight";
import type { CodeBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CodeBlockContent;
}

// Palette fixe (thème sombre type "One Dark") — rendu identique en light et dark.
const TOKEN_COLORS: Record<CodeTokenType, string> = {
  keyword: "#c678dd",
  string: "#98c379",
  comment: "#7f848e",
  number: "#d19a66",
  plain: "#e6edf3",
};

const MONO_FONT = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace";

export default function CodeBlockViewer({ content }: Props) {
  const { copied, copy } = useCopyToClipboard({ defaultToastTitle: "Code copié" });
  const lines = useMemo(
    () => tokenizeCodeLines(content.code, content.language),
    [content.code, content.language],
  );

  if (!content.code.trim()) return null;

  const showLineNumbers = content.showLineNumbers !== false;
  const gutterWidth = `${String(lines.length).length}ch`;

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "#1e242e",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.5rem 0.75rem 0.5rem 1rem",
          background: "#151a21",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span
          className="truncate"
          style={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600, color: "#e6edf3" }}
        >
          {content.title || codeLanguageLabel(content.language)}
        </span>
        {content.title && (
          <span style={{ fontSize: "0.6875rem", color: "#8b949e", fontFamily: MONO_FONT, flexShrink: 0 }}>
            {codeLanguageLabel(content.language)}
          </span>
        )}
        <button
          type="button"
          onClick={() => copy(content.code, { title: "Code copié" })}
          aria-label="Copier le code"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.25rem 0.625rem",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "transparent",
            color: copied ? "#98c379" : "#8b949e",
            fontSize: "0.75rem",
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 120ms, background 120ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "0.875rem 1rem",
          overflowX: "auto",
          fontFamily: MONO_FONT,
          fontSize: "0.8125rem",
          lineHeight: 1.65,
          color: TOKEN_COLORS.plain,
        }}
      >
        <code style={{ fontFamily: "inherit" }}>
          {lines.map((tokens, lineIdx) => (
            <div key={lineIdx} style={{ display: "flex" }}>
              {showLineNumbers && (
                <span
                  aria-hidden="true"
                  className="select-none"
                  style={{
                    width: gutterWidth,
                    marginRight: "1rem",
                    textAlign: "right",
                    color: "#4b5563",
                    flexShrink: 0,
                  }}
                >
                  {lineIdx + 1}
                </span>
              )}
              <span style={{ whiteSpace: "pre" }}>
                {tokens.length === 0
                  ? " "
                  : tokens.map((token, tokenIdx) => (
                      <span
                        key={tokenIdx}
                        style={{
                          color: TOKEN_COLORS[token.type],
                          fontStyle: token.type === "comment" ? "italic" : undefined,
                        }}
                      >
                        {token.value}
                      </span>
                    ))}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
