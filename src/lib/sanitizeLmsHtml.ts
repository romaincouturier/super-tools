import DOMPurify from "dompurify";

/**
 * Sanitizer partagé pour le HTML saisi par les auteurs dans les blocs LMS
 * (consignes d'exercice, corrigés). Autorise les balises HTML classiques
 * (comportement DOMPurify par défaut) plus les iframes d'embed, avec :
 * - src http(s) uniquement (javascript:, data:, protocol-relative -> iframe supprimée)
 * - allowlist stricte d'attributs sur les iframes
 */

const IFRAME_ALLOWED_ATTRS = new Set([
  "src",
  "width",
  "height",
  "allow",
  "allowfullscreen",
  "frameborder",
  "title",
]);

const HTTP_SRC_RE = /^https?:\/\//i;
const HTML_TAG_RE = /<[a-z][^>]*>/i;

// Instance dédiée : les hooks ne polluent pas le DOMPurify global
// utilisé par les autres viewers.
const purify = DOMPurify(window);

purify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName !== "iframe") return;
  const src = node instanceof Element ? node.getAttribute("src") : null;
  if (!src || !HTTP_SRC_RE.test(src.trim())) {
    node.parentNode?.removeChild(node);
  }
});

purify.addHook("uponSanitizeAttribute", (node, data) => {
  if (node.nodeName === "IFRAME" && !IFRAME_ALLOWED_ATTRS.has(data.attrName)) {
    data.keepAttr = false;
  }
});

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder"],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** True si la valeur contient au moins une balise HTML. */
export function containsHtmlTag(value: string): boolean {
  return HTML_TAG_RE.test(value);
}

/**
 * Retourne du HTML sûr prêt pour dangerouslySetInnerHTML.
 * Texte brut (aucune balise) : échappé, sauts de ligne préservés via <br>.
 * HTML : sanitizé (balises classiques + iframes https allowlistées).
 */
export function sanitizeLmsHtml(value: string): string {
  if (!containsHtmlTag(value)) {
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  }
  return purify.sanitize(value, SANITIZE_CONFIG);
}
