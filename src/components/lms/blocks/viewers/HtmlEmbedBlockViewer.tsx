import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeLmsEmbedHtml } from "@/lib/sanitizeLmsEmbedHtml";
import { EMBED_CSP, EMBED_SANDBOX } from "../../../../../supabase/functions/_shared/lms-embed-policy";
import type { HtmlEmbedBlockContent } from "@/types/lms-blocks";

export default function HtmlEmbedBlockViewer({ content, previewMode = false }: { content: HtmlEmbedBlockContent; previewMode?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<() => void>();
  const [height, setHeight] = useState(previewMode ? 240 : 320);
  const html = useMemo(() => sanitizeLmsEmbedHtml(content.html || ""), [content.html]);
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${EMBED_CSP}"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:0;overflow-x:hidden}body{font-family:system-ui,sans-serif;font-size:16px;display:flow-root}img,video,iframe{max-width:100%!important}iframe{width:100%!important;border:0}</style></head><body>${html}</body></html>`;
  useEffect(() => () => cleanupRef.current?.(), []);

  const observe = () => {
    cleanupRef.current?.();
    const doc = iframeRef.current?.contentDocument;
    const body = doc?.body;
    if (!body || !doc) return;
    const resize = () => {
      const next = Math.ceil(Math.max(body.getBoundingClientRect().height, body.scrollHeight)) + 2;
      setHeight((prev) => prev === next ? prev : next);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(body);
    const mutation = new MutationObserver(resize);
    mutation.observe(body, { subtree: true, childList: true, attributes: true, characterData: true });
    doc.addEventListener("toggle", resize, true);
    doc.addEventListener("change", resize, true);
    doc.addEventListener("load", resize, true);
    doc.fonts?.ready.then(resize);
    resize();
    cleanupRef.current = () => {
      observer.disconnect();
      mutation.disconnect();
      doc.removeEventListener("toggle", resize, true);
      doc.removeEventListener("change", resize, true);
      doc.removeEventListener("load", resize, true);
    };
  };
  if (!content.html?.trim()) return null;
  return <div className="w-full min-w-0">
    {content.title && <p className="mb-3 text-lg font-semibold text-foreground">{content.title}</p>}
    <iframe ref={iframeRef} srcDoc={srcDoc} sandbox={EMBED_SANDBOX} onLoad={observe}
      title={content.title || "Contenu intégré"} className={previewMode ? "block w-full rounded-lg border border-border" : "block w-full border-0"}
      style={{ height }} />
  </div>;
}
