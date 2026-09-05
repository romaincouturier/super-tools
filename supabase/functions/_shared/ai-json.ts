/**
 * Tolerant JSON extraction for AI responses.
 * Handles markdown fences, prose before/after the JSON, and trailing commas.
 */

function stripFences(input: string): string {
  let s = input.trim();
  // ```json ... ``` or ``` ... ```
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  // Leftover stray fences
  s = s.replace(/^```(?:json|JSON)?\s*/i, "").replace(/\s*```$/, "");
  return s.trim();
}

/** Extract the first balanced {...} or [...] block, ignoring braces inside strings. */
function firstBalancedBlock(s: string): string | null {
  const start = (() => {
    const o = s.indexOf("{");
    const a = s.indexOf("[");
    if (o === -1) return a;
    if (a === -1) return o;
    return Math.min(o, a);
  })();
  if (start === -1) return null;

  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function removeTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Parse an AI response into JSON, tolerating fences, prose and trailing commas.
 * Returns null when no valid JSON could be extracted.
 */
export function parseAiJson<T = unknown>(raw: string): T | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = stripFences(raw);
  const candidates = [cleaned, firstBalancedBlock(cleaned), firstBalancedBlock(raw)];

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const attempt of [candidate, removeTrailingCommas(candidate)]) {
      try {
        return JSON.parse(attempt) as T;
      } catch { /* try next */ }
    }
  }
  return null;
}

/** Truncated raw response, safe for logs. */
export function truncateForLog(raw: string, max = 2000): string {
  if (!raw) return "";
  return raw.length > max ? `${raw.slice(0, max)}…[${raw.length} chars total]` : raw;
}

export const STRICT_JSON_INSTRUCTION =
  "IMPORTANT : ta réponse précédente n'était pas du JSON valide. Réponds UNIQUEMENT avec l'objet JSON demandé, sans aucun texte avant ou après, sans balises markdown, sans commentaire, sans virgule finale.";
