/**
 * Relevé de ce qu'un visiteur peut lire : texte visible, valeur des champs,
 * infobulles `title`. Un élément flouté (filter: blur) ne compte pas : c'est
 * précisément le masquage des blocs libres et des champs de formulaire.
 */
import type { Page } from "@playwright/test";
import { CANARIES } from "./canary";

export type Readable = { text: string; where: string };
export type Leak = { kind: string; token: string; where: string; excerpt: string };

export async function readableTexts(page: Page): Promise<Readable[]> {
  return page.evaluate(() => {
    const out: { text: string; where: string }[] = [];
    const blurred = new WeakMap<Element, boolean>();
    const isBlurred = (el: Element | null): boolean => {
      if (!el) return false;
      if (blurred.has(el)) return blurred.get(el)!;
      const style = getComputedStyle(el);
      const b = style.filter.includes("blur") || isBlurred(el.parentElement);
      blurred.set(el, b);
      return b;
    };
    const isVisible = (el: Element) => {
      const rects = el.getClientRects();
      if (rects.length === 0) return false;
      const style = getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
    };
    const describe = (el: Element) => {
      const parts: string[] = [];
      let cur: Element | null = el;
      for (let i = 0; cur && i < 4; i++, cur = cur.parentElement) {
        const role = cur.getAttribute("role");
        const label = cur.getAttribute("aria-label");
        parts.unshift(`${cur.tagName.toLowerCase()}${role ? `[role=${role}]` : ""}${label ? `[aria-label="${label.slice(0, 30)}"]` : ""}`);
      }
      const dialog = el.closest('[role="dialog"],[role="alertdialog"]');
      const title = dialog?.querySelector("h2,[id$='title']")?.textContent?.trim();
      // Repère lisible : le titre de section ou le libellé le plus proche.
      let landmark = "";
      for (let c: Element | null = el; c && !landmark; c = c.parentElement) {
        const h = c.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > label, :scope > [class*='CardTitle'], :scope > div > h3");
        if (h && h !== el) landmark = (h.textContent ?? "").trim().slice(0, 40);
      }
      // Composants React qui ont rendu le nœud (build non minifié : noms lisibles).
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      const components: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (let f: any = fiberKey ? (el as any)[fiberKey] : null; f && components.length < 3; f = f.return) {
        const n = typeof f.type === "function" ? f.type.displayName || f.type.name : "";
        if (n && /^[A-Z]/.test(n) && !components.includes(n) && !/^(Primitive|Slot|Presence|Portal|Provider|Dismissable|Focus|Popper|Collection|Context)/.test(n)) components.push(n);
      }
      const labelFor = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() : "";
      return [
        components.length ? `[${components.reverse().join(" > ")}]` : "",
        title ? `modale « ${title.slice(0, 60)} »` : "",
        landmark ? `section « ${landmark} »` : "",
        labelFor ? `champ « ${labelFor.slice(0, 40)} »` : "",
        `<${parts.join(" > ")}>`,
      ].filter(Boolean).join(" › ");
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent?.trim();
      const el = n.parentElement;
      if (!text || !el || !isVisible(el) || isBlurred(el)) continue;
      out.push({ text, where: describe(el) });
    }
    for (const el of Array.from(document.querySelectorAll("input,textarea"))) {
      const v = (el as HTMLInputElement).value;
      if (v && isVisible(el) && !isBlurred(el) && (el as HTMLInputElement).type !== "hidden") {
        out.push({ text: v, where: `champ ${describe(el)}` });
      }
    }
    for (const el of Array.from(document.querySelectorAll("[title]"))) {
      const t = el.getAttribute("title");
      if (t && isVisible(el) && !isBlurred(el)) out.push({ text: t, where: `infobulle ${describe(el)}` });
    }
    return out;
  });
}

export function findLeaks(texts: Readable[]): Leak[] {
  const leaks: Leak[] = [];
  for (const { text, where } of texts) {
    const digits = text.replace(/[\s  .]/g, "");
    for (const c of CANARIES) {
      const haystack = /^\d+$/.test(c.token) ? digits : text;
      if (haystack.includes(c.token)) {
        leaks.push({ kind: c.kind, token: c.token, where, excerpt: text.slice(0, 120) });
      }
    }
  }
  return leaks;
}
