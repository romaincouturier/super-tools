export const EMBED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup",
  "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "input", "ins", "kbd",
  "label", "li", "mark", "ol", "p", "pre", "q", "s", "samp", "small", "span",
  "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "tfoot",
  "th", "thead", "time", "tr", "u", "ul", "var", "iframe", "video", "audio",
  "source", "track", "picture", "section", "article", "header", "footer", "main",
];

export const EMBED_ATTRS = [
  "href", "title", "target", "src", "alt", "class", "id", "for", "name", "type",
  "placeholder", "style", "width", "height", "allow", "allowfullscreen", "frameborder",
  "loading", "controls", "poster", "srcset", "sizes", "referrerpolicy", "srcdoc",
  "value", "checked", "disabled", "open", "role", "aria-label", "aria-labelledby",
  "aria-describedby", "tabindex", "colspan", "rowspan", "preload", "loop", "muted",
];

export const EMBED_INPUT_TYPES = new Set(["radio", "checkbox", "text"]);
export const EMBED_SANDBOX = "allow-same-origin";
export const EMBED_CSP = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; media-src https: http:; frame-src https: http: about:; font-src https: http:; form-action 'none'; object-src 'none'; base-uri 'none'";