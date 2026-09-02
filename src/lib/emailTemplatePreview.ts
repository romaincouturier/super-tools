/**
 * Client-side mirror of supabase/functions/_shared/templates.ts
 * Used only for previewing email templates in the settings screen.
 */

import { getVariableDoc } from "@/lib/emailVariableDocs";

export type PreviewVariables = Record<string, string | undefined | null>;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Same semantics as processTemplate: {{var}} and {{#var}}...{{/var}} */
export function processTemplate(template: string, variables: PreviewVariables, escapeValues = true): string {
  let result = template;

  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let previous = "";
  while (previous !== result) {
    previous = result;
    result = result.replace(conditionalRegex, (_m, varName: string, content: string) =>
      variables[varName] ? content : ""
    );
  }

  return result.replace(/\{\{(\w+)\}\}/g, (_m, varName: string) => {
    const value = variables[varName];
    if (value === null || value === undefined) return "";
    return escapeValues ? escapeHtml(String(value)) : String(value);
  });
}

/**
 * Exact mirror of the server-side formatContentToHtml (see
 * supabase/functions/send-elearning-access/index.ts and friends):
 * the content is split on blank lines; a block that already starts with a
 * block-level tag is kept as-is, any other block becomes a <p> with <br>
 * between its lines. Markdown **bold** is converted first.
 * No escaping: stored templates may legitimately contain inline HTML (<a>, <strong>).
 */
export function textToHtml(text: string): string {
  if (!text) return "";
  const withBold = text.replace(/\r\n/g, "\n").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return withBold
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(p|div|table|ol|ul|h[1-6]|blockquote)\b/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.split(/\n/).map((l) => l.trim()).join("<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}


/** Sample value for a variable, from its documentation when known. */
export function sampleValue(variable: string): string {
  return getVariableDoc(variable).sample;
}

/**
 * Wrap the body HTML exactly like wrapEmailHtml() does server-side,
 * so the preview matches what Gmail receives and renders.
 */
export function wrapEmailHtml(bodyHtml: string, signatureHtml = ""): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; background-color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${bodyHtml}
    ${signatureHtml ? `<div style="margin-top: 20px;">${signatureHtml}</div>` : ""}
  </div>
</body>
</html>`;
}

/** Render a template (subject-less body) to the final email document. */
export function renderEmailDocument(
  content: string,
  variables: PreviewVariables,
  signatureHtml = "",
): string {
  const body = textToHtml(processTemplate(content, variables, false));
  return wrapEmailHtml(body, signatureHtml);

}

/** Collect every {{var}} / {{#var}} referenced in subject + content. */
export function extractVariables(...sources: string[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of (source || "").matchAll(/\{\{#?\/?(\w+)\}\}/g)) {
      found.add(match[1]);
    }
  }
  return [...found];
}
