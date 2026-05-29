/**
 * backfill-practice-hashtags
 *
 * Nightly retry job: for posts created in the last 7 days that have text
 * content but no hashtags (because the synchronous AI call failed at publish),
 * generate and persist hashtags. Idempotent: posts already tagged are skipped.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, createJsonResponse, createErrorResponse } from "../_shared/cors.ts";
import { CLAUDE_DEFAULT } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function generateHashtags(text: string): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
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
        messages: [{ role: "user", content: trimmed.slice(0, 4000) }],
      }),
    });
    if (!res.ok) {
      console.error("anthropic error:", res.status, await res.text());
      return [];
    }
    const result = await res.json();
    const out = result?.content?.[0]?.text ?? "";
    return parseHashtags(out);
  } catch (err) {
    console.error("generateHashtags error:", err);
    return [];
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Last 7 days, posts with text content
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: posts, error: postsErr } = await supabase
      .from("practice_posts")
      .select("id, content, created_at")
      .gte("created_at", since)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (postsErr) throw postsErr;
    if (!posts || posts.length === 0) {
      return createJsonResponse({ processed: 0, tagged: 0, skipped: 0 });
    }

    const postIds = posts.map((p: any) => p.id);
    const { data: existing, error: existingErr } = await supabase
      .from("practice_post_hashtags")
      .select("post_id")
      .in("post_id", postIds);
    if (existingErr) throw existingErr;
    const tagged = new Set((existing || []).map((r: any) => r.post_id));
    const targets = posts.filter((p: any) =>
      !tagged.has(p.id) && typeof p.content === "string" && p.content.trim().length > 0,
    );

    let taggedCount = 0;
    let skipped = 0;

    for (const post of targets) {
      const hashtags = await generateHashtags(post.content);
      if (hashtags.length === 0) {
        skipped++;
        continue;
      }
      const { error: insertErr } = await supabase
        .from("practice_post_hashtags")
        .insert(hashtags.map((tag) => ({ post_id: post.id, tag })));
      if (insertErr) {
        console.error("insert failed for", post.id, insertErr);
        skipped++;
        continue;
      }
      taggedCount++;
      // Gentle pacing for Anthropic
      await new Promise((r) => setTimeout(r, 400));
    }

    return createJsonResponse({
      processed: targets.length,
      tagged: taggedCount,
      skipped,
      window_start: since,
    });
  } catch (err) {
    console.error("backfill-practice-hashtags error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "unknown error", 500);
  }
});
