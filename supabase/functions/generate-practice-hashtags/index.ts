/**
 * generate-practice-hashtags
 *
 * Stateless AI helper: given a community post's text, returns 1-3 short French
 * hashtags. No database access — the caller (learner client) persists them under
 * RLS. Worst case on failure: an empty hashtag list (post creation never blocks).
 */
import { corsHeaders, handleCorsPreflightIfNeeded, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { CLAUDE_DEFAULT } from "../_shared/claude-models.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const SYSTEM_PROMPT = `Tu génères des hashtags pour une publication dans une communauté d'apprenants (formations professionnelles en français).
Règles strictes :
- Entre 1 et 3 hashtags maximum, selon la richesse du contenu.
- Chaque hashtag : un seul mot ou mot composé, en minuscules, sans le caractère #, sans espace, sans accent, sans ponctuation.
- Thématiques concrètes tirées du contenu (sujet, compétence, domaine). Pas de hashtags génériques creux comme "post" ou "communaute".
- Réponds UNIQUEMENT avec un tableau JSON de chaînes, par exemple : ["vente","prospection"]. Aucun autre texte.`;

function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

function parseHashtags(text: string): string[] {
  let arr: unknown;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    arr = JSON.parse(match ? match[0] : text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const tag = normalizeTag(item);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= 3) break;
  }
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const user = await verifyAuth(req.headers.get("Authorization"));
  if (!user) return createErrorResponse("Unauthorized", 401);


  try {
    const { content } = await req.json();
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return createJsonResponse({ hashtags: [] });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_DEFAULT,
        max_tokens: 128,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: text.slice(0, 4000) }],
      }),
    });

    if (!res.ok) {
      console.error("anthropic error:", res.status, await res.text());
      return createJsonResponse({ hashtags: [] });
    }

    const result = await res.json();
    const out = result?.content?.[0]?.text ?? "";
    return createJsonResponse({ hashtags: parseHashtags(out) });
  } catch (err) {
    console.error("generate-practice-hashtags error:", err);
    // Never block post creation on tagging failure.
    return createJsonResponse({ hashtags: [] });
  }
});
