import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { HtmlEmbedBlockContent } from "@/types/lms-blocks";

/**
 * Les lecteurs YouTube/Vimeo refusent de fonctionner dans l'origine opaque du
 * bac à sable. Leurs iframes ne sont donc jamais chargées dedans : le bac à
 * sable remonte l'adresse et la position de chaque vidéo, et la page les
 * affiche par-dessus, hors bac à sable, après validation stricte de l'adresse.
 */
const VIDEO_SRC_RE = String.raw`^https://(?:www\.)?(?:youtube\.com/embed/|youtube-nocookie\.com/embed/|player\.vimeo\.com/video/)`;
export function safeVideoEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const yt = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(u.hostname) && /^\/embed\/[\w-]+$/.test(u.pathname);
    const vimeo = u.hostname === "player.vimeo.com" && /^\/video\/\d+$/.test(u.pathname);
    return yt || vimeo ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Retire le src des iframes vidéo écrites en dur pour qu'elles ne se chargent pas dans le bac à sable. */
export function deferVideoIframes(html: string): string {
  return html.replace(/(<iframe\b[^>]*?\s)src=(["'])(https:\/\/[^"']*)\2/gi, (m, pre, q, url) =>
    new RegExp(VIDEO_SRC_RE, "i").test(url) ? `${pre}data-st-video=${q}${url}${q}` : m);
}

type EmbedVideo = { k: number; src: string; x: number; y: number; w: number; h: number; r: string };

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
var VRE=new RegExp(${JSON.stringify(VIDEO_SRC_RE)},'i'),sa=Element.prototype.setAttribute,ga=Element.prototype.getAttribute,ra=Element.prototype.removeAttribute;
Element.prototype.setAttribute=function(n,v){if(this.tagName==='IFRAME'&&String(n).toLowerCase()==='src'){if(VRE.test(String(v))){sa.call(this,'data-st-video',String(v));ra.call(this,'src');vs();return;}ra.call(this,'data-st-video');}return sa.call(this,n,v);};
Element.prototype.getAttribute=function(n){if(this.tagName==='IFRAME'&&String(n).toLowerCase()==='src'&&this.hasAttribute('data-st-video'))return ga.call(this,'data-st-video');return ga.call(this,n);};
var d=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'src');
Object.defineProperty(HTMLIFrameElement.prototype,'src',{configurable:true,get:function(){return this.hasAttribute('data-st-video')?ga.call(this,'data-st-video'):d.get.call(this)},set:function(v){this.setAttribute('src',v)}});
var vk=0,lv='';function vs(){var out=[];document.querySelectorAll('iframe[data-st-video]').forEach(function(f){if(!f.__stk)f.__stk=++vk;var r=f.getBoundingClientRect(),cs=getComputedStyle(f);if(r.width<2||r.height<2||cs.visibility==='hidden')return;var p=f.parentElement,rad=cs.borderRadius;if(p&&(!rad||rad==='0px')){var pc=getComputedStyle(p);if(pc.overflow!=='visible')rad=pc.borderRadius;}out.push({k:f.__stk,src:ga.call(f,'data-st-video'),x:r.left,y:r.top,w:r.width,h:r.height,r:rad});});var j=JSON.stringify(out);if(j!==lv){lv=j;parent.postMessage({lmsEmbed:${JSON.stringify(id)},videos:out},'*');}}
document.addEventListener('DOMContentLoaded',function(){vs();new ResizeObserver(vs).observe(document.body);new MutationObserver(vs).observe(document.body,{subtree:true,childList:true,attributes:true});});
window.addEventListener('resize',vs);window.addEventListener('load',vs);setInterval(vs,400);
})();</script>`;

export function buildEmbedSrcDoc(html: string, id: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${AUTHOR_EMBED_CSP}"><base target="_blank">${bootstrap(id)}<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:0;overflow-x:hidden}body{font-family:system-ui,sans-serif;font-size:16px;display:flow-root}img,video,iframe{max-width:100%!important}iframe{border:0}</style></head><body>${deferVideoIframes(html)}</body></html>`;
}

export default function HtmlEmbedBlockViewer({ content, previewMode = false }: { content: HtmlEmbedBlockContent; previewMode?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const id = useId();
  const [height, setHeight] = useState(previewMode ? 240 : 320);
  const [videos, setVideos] = useState<EmbedVideo[]>([]);
  const srcDoc = useMemo(() => buildEmbedSrcDoc(content.html || "", id), [content.html, id]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data as { lmsEmbed?: string; height?: number; videos?: unknown };
      if (d?.lmsEmbed !== id) return;
      if (Array.isArray(d.videos)) {
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
        setVideos(d.videos.slice(0, 20).flatMap((v: Record<string, unknown>) => {
          const src = safeVideoEmbedUrl(v?.src);
          const [k, x, y, w, h] = [v?.k, v?.x, v?.y, v?.w, v?.h].map(num);
          if (!src || [k, x, y, w, h].some(Number.isNaN)) return [];
          const r = typeof v.r === "string" && /^[\d.\spx%]{1,40}$/.test(v.r) ? v.r : "0px";
          return [{ k, src, x: Math.max(0, x), y: Math.max(0, y), w: Math.min(w, 4000), h: Math.min(h, 4000), r }];
        }));
        return;
      }
      if (typeof d.height !== "number" || !Number.isFinite(d.height)) return;
      setHeight(Math.min(Math.max(d.height, 40), 20000));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  if (!content.html?.trim()) return null;
  return <div className="w-full min-w-0">
    {content.title && <p className="mb-3 text-lg font-semibold text-foreground">{content.title}</p>}
    <div className="relative">
    <iframe ref={iframeRef} srcDoc={srcDoc} sandbox={AUTHOR_EMBED_SANDBOX}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
      allowFullScreen
      title={content.title || "Contenu intégré"} className={previewMode ? "block w-full rounded-lg border border-border" : "block w-full border-0"}
      style={{ height }} />
    {videos.map((v) => <iframe key={v.k} src={v.src} title="Vidéo"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
      allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
      className="absolute border-0" style={{ left: v.x, top: v.y, width: v.w, height: v.h, borderRadius: v.r, maxHeight: Math.max(0, height - v.y), maxWidth: "100%" }} />)}
    </div>
  </div>;
}
