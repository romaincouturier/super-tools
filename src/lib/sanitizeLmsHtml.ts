import DOMPurify from "dompurify";

/**
 * Sanitizer partagé pour le HTML saisi par les auteurs dans les blocs LMS
 * (consignes d'exercice, corrigés) et pour le rendu des pages de mission.
 * Autorise les balises HTML classiques (comportement DOMPurify par défaut)
 * plus les iframes d'embed, avec :
 * - src http(s) uniquement (javascript:, data:, protocol-relative -> iframe supprimée)
 * - allowlist stricte d'attributs sur les iframes
 *
 * Le SVG inline est conservé : c'est ainsi qu'un schéma vectoriel produit par
 * l'agent (save_mission_note du serveur MCP) s'affiche dans une page. Le
 * profil SVG de DOMPurify tient l'invariant de sécurité — script, handlers
 * `on*` et foreignObject restent supprimés. Les balises sont listées
 * explicitement plutôt que laissées au défaut de la bibliothèque : un
 * `USE_PROFILES` ou un `ALLOWED_TAGS` ajouté ici plus tard les ferait
 * disparaître sans bruit.
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

const SVG_TAGS = [
  "svg",
  "g",
  "defs",
  "marker",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
];

const SVG_ATTRS = [
  "viewbox",
  "preserveaspectratio",
  "xmlns",
  "d",
  "points",
  "transform",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "dx",
  "dy",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "opacity",
  "marker-start",
  "marker-mid",
  "marker-end",
  "markerwidth",
  "markerheight",
  "refx",
  "refy",
  "orient",
];

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe", ...SVG_TAGS],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", ...SVG_ATTRS],
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
