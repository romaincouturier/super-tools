import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HtmlEmbedBlockContent } from "@/types/lms-blocks";

/**
 * Les blocs HTML d'auteur (exercices, Tally, animations) ont besoin de leurs
 * scripts. Ils tournent dans une iframe srcdoc SANS allow-same-origin : origine
 * opaque, aucun accès à la session, au stockage ni au DOM de l'application.
 * Les styles restent confinés dans l'iframe.
 */
export const AUTHOR_EMBED_SANDBOX =
  "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals";
export const AUTHOR_EMBED_CSP =
  "default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src https: http: data: blob:; media-src https: http: blob: data:; frame-src https: http: about: data:; font-src https: data:; connect-src https:; form-action https:; object-src 'none'; base-uri 'none'";

// Exécuté avant le contenu : déclenche immédiatement les écouteurs
// DOMContentLoaded/load ajoutés après coup, et remonte la hauteur au parent.
const bootstrap = (id: string) => `<script>(function(){
var add=EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener=function(t,f,o){
  add.call(this,t,f,o);
  if(!f)return;
  var late=(t==='DOMContentLoaded'&&(this===document||this===window)&&document.readyState!=='loading')||(t==='load'&&this===window&&document.readyState==='complete');
  if(late){var self=this;setTimeout(function(){try{typeof f==='function'?f.call(self,new Event(t)):f.handleEvent(new Event(t))}catch(e){console.error(e)}},0);}
};
var last=0;function send(){var b=document.body;if(!b)return;var h=Math.ceil(Math.max(b.getBoundingClientRect().height,b.scrollHeight))+2;if(h!==last){last=h;parent.postMessage({lmsEmbed:${JSON.stringify(id)},height:h},'*');}}
document.addEventListener('DOMContentLoaded',function(){send();new ResizeObserver(send).observe(document.body);new MutationObserver(send).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});});
window.addEventListener('load',send);['toggle','change','click','transitionend','animationend'].forEach(function(e){document.addEventListener(e,function(){setTimeout(send,50)},true)});
setInterval(send,1000);
})();</script>`;

export function buildEmbedSrcDoc(html: string, id: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${AUTHOR_EMBED_CSP}"><base target="_blank">${bootstrap(id)}<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:0;overflow-x:hidden}body{font-family:system-ui,sans-serif;font-size:16px;display:flow-root}img,video,iframe{max-width:100%!important}iframe{border:0}</style></head><body>${html}</body></html>`;
}

export default function HtmlEmbedBlockViewer({ content, previewMode = false }: { content: HtmlEmbedBlockContent; previewMode?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const id = useId();
  const [height, setHeight] = useState(previewMode ? 240 : 320);
  const srcDoc = useMemo(() => buildEmbedSrcDoc(content.html || "", id), [content.html, id]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { lmsEmbed?: string; height?: number };
      if (d?.lmsEmbed !== id || typeof d.height !== "number" || !Number.isFinite(d.height)) return;
      setHeight(Math.min(Math.max(d.height, 40), 20000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  if (!content.html?.trim()) return null;
  return <div className="w-full min-w-0">
    {content.title && <p className="mb-3 text-lg font-semibold text-foreground">{content.title}</p>}
    <iframe ref={iframeRef} srcDoc={srcDoc} sandbox={AUTHOR_EMBED_SANDBOX}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
      allowFullScreen
      title={content.title || "Contenu intégré"} className={previewMode ? "block w-full rounded-lg border border-border" : "block w-full border-0"}
      style={{ height }} />
  </div>;
}
