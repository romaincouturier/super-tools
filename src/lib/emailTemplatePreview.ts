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
 * Same semantics as the server textToHtml (supabase/functions/_shared/templates.ts):
 * blank line = new paragraph, single newline = <br>, **bold** = <strong>.
 * Escaping is applied first, bold markers after, so user text is never un-escaped.
 */
export function textToHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map((line) => escapeHtml(line.trim()));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** True when the content already contains HTML markup (stored templates may be HTML). */
export function looksLikeHtml(content: string): boolean {
  return /<(p|div|br|table|h[1-6]|a|ul|ol|strong)\b/i.test(content);
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
  const body = looksLikeHtml(content)
    ? processTemplate(content, variables, false)
    : textToHtml(processTemplate(content, variables, false));
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
