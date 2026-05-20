import { useRef, useState } from "react";
import type { HtmlEmbedBlockContent } from "@/types/lms-blocks";

interface Props {
  content: HtmlEmbedBlockContent;
  /** When true (editor preview), show a compact frame; false = full learner view. */
  previewMode?: boolean;
}

/**
 * Renders author-supplied HTML / embed code inside a sandboxed iframe.
 *
 * The srcdoc iframe is same-origin with the host page because srcdoc content
 * is treated as about:blank (null origin) by browsers, so allow-same-origin
 * is required for inner iframes (e.g. LinkedIn) to initialise their scripts.
 * This is acceptable here because only admin users can author embed blocks.
 *
 * Responsive styles injected into the srcdoc override any fixed `width`
 * attribute on inner iframes so embeds fill their container on mobile.
 */
export default function HtmlEmbedBlockViewer({ content, previewMode = false }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(previewMode ? 240 : 320);
  const [loadError, setLoadError] = useState(false);

  if (!content.html?.trim()) return null;

  const INJECTED_STYLES = `
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; overflow-x: hidden; font-family: sans-serif; }
      img, video, iframe { max-width: 100% !important; }
      iframe { width: 100% !important; border: none; }
    </style>
  `;

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${INJECTED_STYLES}</head><body>${content.html}</body></html>`;

  const handleLoad = () => {
    try {
      const doc = iframeRef.current?.contentWindow?.document;
      if (doc?.body) {
        const h = doc.body.scrollHeight;
        if (h > 0) setIframeHeight(h + 24);
      }
    } catch {
      // Cross-origin inner frames can block scrollHeight access — keep default height.
    }
  };

  const handleError = () => setLoadError(true);

  return (
    <div style={{ width: "100%" }}>
      {content.title && (
        <p
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--st-ink)",
          }}
        >
          {content.title}
        </p>
      )}

      {loadError ? (
        <div
          style={{
            padding: "1.5rem",
            borderRadius: 12,
            border: "1.5px solid rgba(220,38,38,0.2)",
            background: "rgba(220,38,38,0.04)",
            color: "#dc2626",
            fontSize: "0.875rem",
          }}
        >
          Le contenu intégré n'a pas pu être chargé. Vérifiez le code HTML saisi.
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            borderRadius: previewMode ? 8 : 0,
            overflow: "hidden",
            border: previewMode ? "1px solid rgba(16,24,32,0.10)" : "none",
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={srcDoc}
            // allow-same-origin required for inner iframes (LinkedIn, YouTube…) to load.
            // allow-popups-to-escape-sandbox lets links open in a new tab correctly.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-popups-to-escape-sandbox"
            style={{
              display: "block",
              width: "100%",
              height: iframeHeight,
              border: "none",
            }}
            title={content.title || "Contenu intégré"}
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      )}
    </div>
  );
}
