/**
 * Client-side mirror of supabase/functions/_shared/templates.ts
 * Used only for previewing email templates in the settings screen.
 */

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

/** Same semantics as textToHtml */
export function textToHtml(text: string): string {
  if (!text) return "";
  const processed = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return processed
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph.split(/\n/).map((line) => escapeHtml(line.trim()));
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>");
}

/** True when the content already contains HTML markup (stored templates may be HTML). */
export function looksLikeHtml(content: string): boolean {
  return /<(p|div|br|table|h[1-6]|a|ul|ol|strong)\b/i.test(content);
}

/** Sample value for a variable, guessed from its name. */
export function sampleValue(variable: string): string {
  const v = variable.toLowerCase();
  if (v.endsWith("_link") || v.endsWith("_url") || v === "link" || v === "url") {
    return "https://super-tools.lovable.app/exemple";
  }
  if (v.includes("first_name")) return v.includes("sponsor") ? "Claire" : "Sophie";
  if (v.includes("last_name")) return "Bergaglio";
  if (v.includes("email")) return "sophie.exemple@gmail.com";
  if (v.includes("phone")) return "06 12 34 56 78";
  if (v.includes("company") || v.includes("entreprise")) return "Acme SAS";
  if (v.includes("trainer")) return "Romain Couturier";
  if (v.includes("training_name") || v === "title" || v.includes("course")) {
    return "Facilitation graphique - niveau 1";
  }
  if (v.includes("date")) return "12 mars 2026";
  if (v.includes("time") || v.includes("heure")) return "09h00";
  if (v.includes("duration")) return "14 heures";
  if (v.includes("location") || v.includes("lieu") || v.includes("address")) return "Paris 11e";
  if (v.includes("price") || v.includes("amount") || v.includes("montant")) return "1 200 EUR";
  if (v.includes("count") || v.includes("number") || v.includes("nb_")) return "3";
  if (v.includes("name")) return "Sophie Bergaglio";
  return `Exemple ${variable}`;
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
