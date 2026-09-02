/**
 * Client-side mirror of supabase/functions/_shared/templates.ts
 * Used only for previewing email templates in the settings screen.
 *
 * Three rendering variants exist server-side; the preview must use the same one
 * as the function that actually sends a given template, otherwise the preview
 * lies (bullets, raw HTML, escaping).
 */

import { getVariableDoc } from "@/lib/emailVariableDocs";

export type PreviewVariables = Record<string, string | undefined | null>;

/** Which server-side body renderer a template goes through. */
export type PreviewRenderer = "escaped" | "bullets" | "raw-blocks";

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
 * Exact mirror of _shared/templates.ts textToHtml(): markdown bold is converted
 * first, then EVERY line is HTML-escaped and wrapped in <p>/<br>.
 * Consequence (faithfully reproduced): inline HTML typed in a template arrives
 * as visible source code in the real email.
 */
export function escapedTextToHtml(text: string): string {
  if (!text) return "";
  const processed = text.replace(/\r\n/g, "\n").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return processed
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map((line) => escapeHtml(line.trim()));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

/**
 * Exact mirror of _shared/templates.ts templateTextToHtml(): lines starting with
 * • or - become <ul><li> items; no escaping.
 */
export function bulletTextToHtml(text: string): string {
  if (!text) return "";

  const htmlParts: string[] = [];
  const paragraphLines: string[] = [];
  const bulletLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    htmlParts.push(`<p>${paragraphLines.join("<br>")}</p>`);
    paragraphLines.length = 0;
  };

  const flushBullets = () => {
    if (bulletLines.length === 0) return;
    const items = bulletLines.map((b) => `<li>${b}</li>`).join("\n");
    htmlParts.push(`<ul style="margin: 8px 0; padding-left: 20px;">\n${items}\n</ul>`);
    bulletLines.length = 0;
  };

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (bulletLines.length > 0) continue;
      flushParagraph();
      continue;
    }

    if (/^[•\-]\s*/.test(line)) {
      flushParagraph();
      bulletLines.push(line.replace(/^[•\-]\s*/, ""));
      continue;
    }

    flushBullets();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushBullets();

  return htmlParts.join("\n");
}

/**
 * Mirror of the local formatContentToHtml used by send-elearning-access and
 * send-learner-magic-link: blocks already starting with a block-level tag pass
 * through untouched, everything else becomes a <p>. No escaping.
 */
export function rawBlocksTextToHtml(text: string): string {
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

/** Which renderer each template type goes through server-side. */
const RENDERER_BY_TEMPLATE_TYPE: Record<string, PreviewRenderer> = {
  elearning_access: "raw-blocks",
  elearning_magic_link: "raw-blocks",
  live_reminder: "bullets",
  today_reminder: "bullets",
  trainer_today_reminder: "bullets",
};

export function rendererForTemplateType(templateType?: string): PreviewRenderer {
  if (!templateType) return "escaped";
  return RENDERER_BY_TEMPLATE_TYPE[templateType] ?? "escaped";
}

export const RENDERER_LABELS: Record<PreviewRenderer, string> = {
  escaped: "Texte simple : le HTML tapé dans le modèle apparaîtra tel quel dans l'email.",
  bullets: "Les lignes commençant par • ou - deviennent une liste à puces.",
  "raw-blocks": "Le HTML tapé dans le modèle est conservé et interprété.",
};

export function bodyToHtml(text: string, renderer: PreviewRenderer): string {
  if (renderer === "bullets") return bulletTextToHtml(text);
  if (renderer === "raw-blocks") return rawBlocksTextToHtml(text);
  return escapedTextToHtml(text);
}

/** Sample value for a variable, from its documentation when known. */
export function sampleValue(variable: string): string {
  return getVariableDoc(variable).sample;
}

/**
 * Wrap the body HTML exactly like _shared/templates.ts wrapEmailHtml() does,
 * so the preview matches what Gmail receives and renders.
 */
export function wrapEmailHtml(bodyHtml: string, signatureHtml = ""): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${bodyHtml}
    <div style="margin-top: 20px;">
      ${signatureHtml}
    </div>
  </div>
</body>
</html>`;
}

/** Render a template (subject-less body) to the final email document. */
export function renderEmailDocument(
  content: string,
  variables: PreviewVariables,
  renderer: PreviewRenderer = "escaped",
  signatureHtml = "",
): string {
  const body = bodyToHtml(processTemplate(content, variables, false), renderer);
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
