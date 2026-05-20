import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InlineEdit } from "./InlineEdit";
import HtmlEmbedBlockViewer from "../viewers/HtmlEmbedBlockViewer";
import type { HtmlEmbedBlockContent } from "@/types/lms-blocks";

interface Props {
  content: HtmlEmbedBlockContent;
  onChange: (content: HtmlEmbedBlockContent) => void;
  slim?: boolean;
}

export default function HtmlEmbedBlockEditor({ content, onChange, slim }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Optional title */}
      <InlineEdit
        value={content.title || ""}
        onChange={(v) => onChange({ ...content, title: v || null })}
        placeholder="Titre du bloc (facultatif)…"
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--st-ink)",
          outline: "none",
          display: "block",
          width: "100%",
        }}
      />

      {/* HTML textarea */}
      <div
        style={{
          borderRadius: 12,
          border: "1.5px solid rgba(16,24,32,0.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 0.75rem",
            borderBottom: "1px solid rgba(16,24,32,0.08)",
            background: "rgba(16,24,32,0.03)",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--st-ink-50)", fontFamily: "monospace" }}>
            HTML / Embed
          </span>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: previewOpen ? "var(--st-ink)" : "var(--st-ink-50)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
            {previewOpen ? "Masquer l'aperçu" : "Aperçu"}
          </button>
        </div>
        <textarea
          value={content.html}
          onChange={(e) => onChange({ ...content, html: e.target.value })}
          placeholder={'<iframe src="https://…" height="400" width="100%" frameborder="0" allowfullscreen></iframe>'}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: slim ? 120 : 180,
            padding: "0.75rem",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
            color: "var(--st-ink)",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Collapsible preview */}
      {previewOpen && (
        <div
          style={{
            borderRadius: 12,
            border: "1.5px solid rgba(16,24,32,0.10)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.375rem 0.75rem",
              borderBottom: "1px solid rgba(16,24,32,0.08)",
              background: "rgba(16,24,32,0.02)",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "var(--st-ink-50)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Aperçu
          </div>
          <div style={{ padding: "1rem" }}>
            {content.html.trim() ? (
              <HtmlEmbedBlockViewer content={content} previewMode />
            ) : (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--st-ink-50)", fontStyle: "italic" }}>
                Collez du code HTML pour voir l'aperçu.
              </p>
            )}
          </div>
        </div>
      )}

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--st-ink-50)" }}>
        Accepte tout code HTML valide : iframes LinkedIn, YouTube, cartes, widgets externes…
        Le contenu est isolé dans un cadre sécurisé.
      </p>
    </div>
  );
}
