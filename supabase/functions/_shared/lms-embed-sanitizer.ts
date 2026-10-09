import sanitize from "https://esm.sh/sanitize-html@2.17.0";
import { EMBED_ATTRS, EMBED_INPUT_TYPES, EMBED_SANDBOX, EMBED_TAGS } from "./lms-embed-policy.ts";

export function sanitizeEmbedHtml(value: string, depth = 0): string {
  if (depth > 4) return "";
  return sanitize(value, {
    allowedTags: EMBED_TAGS,
    allowedAttributes: { "*": [...EMBED_ATTRS, "sandbox"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    nonTextTags: ["script", "textarea", "option", "noscript", "object", "embed"],
    exclusiveFilter: (frame: { tag: string; attribs: Record<string, string> }) =>
      frame.tag === "input" && !EMBED_INPUT_TYPES.has((frame.attribs.type || "text").toLowerCase()),
    transformTags: {
      iframe: (tagName: string, attribs: Record<string, string>) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.srcdoc ? { srcdoc: sanitizeEmbedHtml(attribs.srcdoc, depth + 1) } : {}),
          sandbox: EMBED_SANDBOX,
        },
      }),
    },
  });
}