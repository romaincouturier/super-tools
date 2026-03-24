/**
 * Template Processing Module
 *
 * Handles template variable substitution and conditional blocks
 */

import { escapeHtml } from "./resend.ts";

export type TemplateVariables = Record<string, string | boolean | null | undefined>;

/**
 * Process a template with variables
 *
 * Supports:
 * - Simple variables: {{variableName}}
 * - Conditional blocks: {{#variableName}}content{{/variableName}}
 *
 * @param template - Template string with placeholders
 * @param variables - Variables to substitute
 * @param escapeValues - Whether to HTML-escape values (default: true)
 * @returns Processed template string
 */
export function processTemplate(
  template: string,
  variables: TemplateVariables,
  escapeValues = true
): string {
  let result = template;

  // Process conditional blocks: {{#var}}content{{/var}}
  // Loop to handle nested conditionals (inner blocks revealed after outer ones are resolved)
  const conditionalRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let previousResult = "";
  while (previousResult !== result) {
    previousResult = result;
    result = result.replace(conditionalRegex, (_match, varName, content) => {
      const value = variables[varName];
      return value ? content : "";
    });
  }

  // Process simple variables: {{var}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (_match: string, varName: string): string => {
    const value = variables[varName];
    if (value === null || value === undefined) {
      return "";
    }
    return escapeValues ? escapeHtml(String(value)) : String(value);
  });

  return result;
}

/**
 * Replace variables in a template (alias for processTemplate without escaping)
 *
 * @param template - Template string with placeholders
 * @param variables - Variables to substitute
 * @returns Processed template string
 */
export function replaceVariables(
  template: string,
  variables: TemplateVariables
): string {
  return processTemplate(template, variables, false);
}

/**
 * Convert plain text to HTML paragraphs
 * Also converts markdown bold **text** to <strong>text>
 *
 * @param text - Plain text with newlines
 * @returns HTML with <p> tags
 */
export function textToHtml(text: string): string {
  if (!text) return "";

  // Convert markdown bold **text** to <strong>text</strong>
  let processed = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return processed
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map((line) => escapeHtml(line.trim()));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

/**
 * Create a standard email HTML wrapper
 *
 * @param bodyHtml - Email body HTML content
 * @param signature - HTML signature to append
 * @returns Complete email HTML
 */
export function wrapEmailHtml(bodyHtml: string, signature: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${bodyHtml}
    <div style="margin-top: 20px;">
      ${signature}
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ───── Shared email UI components ─────

/** Brand color for CTA buttons */
const CTA_BG = "#e6bc00";
const CTA_TEXT = "#1a1a1a";

/**
 * Generate a standard CTA button for emails.
 * All email buttons across the app should use this function
 * for consistent styling.
 */
export function emailButton(label: string, url: string): string {
  return `<p style="margin: 20px 0;">
  <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: ${CTA_BG}; color: ${CTA_TEXT}; text-decoration: none; border-radius: 6px; font-weight: bold;">
    ${label}
  </a>
</p>`;
}

/**
 * Generate a highlighted info box for emails.
 */
export function emailInfoBox(content: string): string {
  return `<div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
  ${content}
</div>`;
}

/**
 * Generate a success/resolution box for emails.
 */
/**
 * Convert template text to HTML with bullet list support.
 * Lines starting with • or - are grouped into <ul><li> elements.
 */
export function templateTextToHtml(text: string): string {
  if (!text) return "";

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim() !== "");
  const htmlParts: string[] = [];

  for (const para of paragraphs) {
    const lines = para.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let currentText: string[] = [];
    let currentBullets: string[] = [];

    const flushText = () => {
      if (currentText.length > 0) {
        htmlParts.push(`<p>${currentText.join("<br>")}</p>`);
        currentText = [];
      }
    };

    const flushBullets = () => {
      if (currentBullets.length > 0) {
        const items = currentBullets.map((b) => `<li>${b}</li>`).join("\n");
        htmlParts.push(`<ul style="margin: 8px 0; padding-left: 20px;">\n${items}\n</ul>`);
        currentBullets = [];
      }
    };

    for (const line of lines) {
      if (/^[•\-]\s/.test(line)) {
        flushText();
        currentBullets.push(line.replace(/^[•\-]\s*/, ""));
      } else {
        flushBullets();
        currentText.push(line);
      }
    }

    flushText();
    flushBullets();
  }

  return htmlParts.join("\n");
}

/**
 * Generate a success/resolution box for emails.
 */
export function emailSuccessBox(title: string, content: string): string {
  return `<div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #22c55e; border-radius: 4px; margin: 20px 0;">
  <p style="margin: 0 0 5px 0; font-weight: bold; color: #166534;">${title}</p>
  <p style="margin: 0; color: #1a1a1a; white-space: pre-wrap;">${content}</p>
</div>`;
}
