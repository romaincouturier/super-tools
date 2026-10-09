import DOMPurify from "dompurify";
import { EMBED_ATTRS, EMBED_INPUT_TYPES, EMBED_SANDBOX, EMBED_TAGS } from "../../supabase/functions/_shared/lms-embed-policy";

export function sanitizeLmsEmbedHtml(value: string, depth = 0): string {
  if (depth > 4) return "";
  const purify = DOMPurify(window);
  const nestedDocuments = new WeakMap<Element, string>();
  purify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "input" && node instanceof Element) {
      const type = (node.getAttribute("type") || "text").toLowerCase();
      if (!EMBED_INPUT_TYPES.has(type)) node.parentNode?.removeChild(node);
    }
  });
  purify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName.startsWith("on")) data.keepAttr = false;
    if (node.nodeName === "IFRAME" && data.attrName === "srcdoc") {
      if (node instanceof Element) nestedDocuments.set(node, sanitizeLmsEmbedHtml(data.attrValue, depth + 1));
      data.keepAttr = false;
    }
  });
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "IFRAME" && node instanceof Element) {
      node.setAttribute("sandbox", EMBED_SANDBOX);
      const nested = nestedDocuments.get(node);
      if (nested !== undefined) node.setAttribute("srcdoc", nested);
    }
  });
  return purify.sanitize(value, {
    ALLOWED_TAGS: EMBED_TAGS,
    ALLOWED_ATTR: EMBED_ATTRS,
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
  });
}