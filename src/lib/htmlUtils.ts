/** Convert HTML string to plain text by stripping all tags. */
export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

/** Remove markdown code fences that LLMs sometimes wrap around HTML output. */
export function cleanHtmlOutput(raw: string): string {
  return raw
    .replace(/^```(?:html?)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
