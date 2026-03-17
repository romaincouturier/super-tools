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
  ${bodyHtml}
  ${signature}
</body>
</html>
  `.trim();
}
