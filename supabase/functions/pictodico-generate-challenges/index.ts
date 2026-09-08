import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";
import { logAnthropicUsage } from "../_shared/api-usage.ts";
import {
  parseAiJson,
  parseTruncatedAiJson,
  truncateForLog,
  STRICT_JSON_INSTRUCTION,
} from "../_shared/ai-json.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Septembre -> Juin, dans l'ordre de l'année scolaire. */
function buildSchedule(startYear: number): Array<{ month: number; year: number; label: string }> {
  const months = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
  const labels: Record<number, string> = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
  };
  return months.map((month) => {
    const year = month >= 9 ? startYear : startYear + 1;
    return { month, year, label: `${labels[month]} ${year}` };
  });
}

interface ThemeInput {
  theme: string;
  description?: string;
}

async function callAnthropic(systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_ADVANCED,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errText.slice(0, 500)}`);
  }
  const aiData = await response.json();
  await logAnthropicUsage({
    origin: "pictodico-generate-challenges",
    operation: "challenges",
    model: CLAUDE_ADVANCED,
    trigger: "manual",
    usage: aiData.usage,
  });
  // Concatène tous les blocs texte (les modèles récents peuvent renvoyer
  // des blocs "thinking" avant le texte, d'où content[0] parfois vide).
  const text = Array.isArray(aiData.content)
    ? aiData.content
        .filter((b: { type?: string; text?: string }) => typeof b?.text === "string")
        .map((b: { text: string }) => b.text)
        .join("\n")
        .trim()
    : "";
  if (!text) {
    console.error(
      "[pictodico-generate-challenges] réponse Anthropic sans texte:",
      JSON.stringify({
        stop_reason: aiData.stop_reason,
        content_types: Array.isArray(aiData.content)
          ? aiData.content.map((b: { type?: string }) => b?.type)
          : null,
      }),
    );
  }
  return text;
}


serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  if (!ANTHROPIC_API_KEY) return json({ error: "AI not configured" }, 503);

  let body: { words?: string[]; startYear?: number; themes?: ThemeInput[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { words, startYear, themes } = body;
  if (!Array.isArray(words)) return json({ error: "words must be an array" }, 400);
  if (!startYear || typeof startYear !== "number") return json({ error: "startYear must be a number" }, 400);
  if (!Array.isArray(themes) || themes.length === 0) return json({ error: "themes must be a non-empty array" }, 400);

  const cleanThemes = themes
    .map((t) => ({ theme: String(t.theme || "").trim(), description: String(t.description || "").trim() }))
    .filter((t) => t.theme.length > 0)
    .slice(0, 10);

  if (cleanThemes.length === 0) return json({ error: "Aucun thème valide" }, 400);

  const uniqueWords = [
    ...new Set(words.map((w) => String(w).trim().toLowerCase()).filter((w) => w.length > 1)),
  ];

  const schedule = buildSchedule(startYear).slice(0, cleanThemes.length);

  const systemPrompt = `Tu es un expert en orthophonie et en communication alternative et augmentée (CAA) pour le site picto-dico.fr, spécialisé dans les pictogrammes.

On te donne une liste de thèmes mensuels et une liste de mots collectés auprès des utilisateurs.
Pour chaque thème, tu sélectionnes parmi les MOTS COLLECTÉS ceux qui se rapportent au thème.

RÈGLES ABSOLUES :
- N'utilise QUE des mots présents dans la liste des mots collectés, à l'identique (même orthographe).
- N'invente jamais de mot.
- Un même mot peut être utilisé pour un seul thème (le plus pertinent) : aucun doublon d'un thème à l'autre.
- Sélectionne au maximum 18 mots par thème, les plus pertinents d'abord.
- Si un thème n'a aucun mot pertinent, retourne un tableau de mots vide.
- Retourne UNIQUEMENT du JSON valide, sans texte avant ni après, sans markdown.`;


  const themesText = cleanThemes
    .map((t, i) => `${i + 1}. ${schedule[i].label} — ${t.theme}${t.description ? ` : ${t.description}` : ""}`)
    .join("\n");

  const userPrompt = `Thèmes de l'année scolaire ${startYear}-${startYear + 1} :
${themesText}

Mots collectés (${uniqueWords.length}) :
${uniqueWords.length > 0 ? uniqueWords.join(", ") : "(aucun mot collecté)"}

Retourne un tableau JSON d'objets, un par thème, dans le même ordre :
[{ "index": 1, "words": ["mot1", "mot2"] }]`;

  try {
    let raw = await callAnthropic(systemPrompt, userPrompt);
    let parsed = parseAiJson<Array<{ index: number; words: string[] }>>(raw);

    if (!Array.isArray(parsed)) {
      raw = await callAnthropic(systemPrompt, `${userPrompt}\n\n${STRICT_JSON_INSTRUCTION}`);
      parsed = parseAiJson<Array<{ index: number; words: string[] }>>(raw);
    }

    if (!Array.isArray(parsed)) {
      console.error("[pictodico-generate-challenges] réponse IA non parseable:", truncateForLog(raw));
      return json(
        { error: "L'IA n'a pas réussi à rattacher les mots aux thèmes. Réessayez dans un instant." },
        502,
      );
    }

    const allowed = new Set(uniqueWords);
    const used = new Set<string>();

    const challenges = cleanThemes.map((t, i) => {
      const entry = parsed!.find((p) => Number(p.index) === i + 1) ?? parsed![i];
      const picked = Array.isArray(entry?.words) ? entry.words : [];
      const selected: string[] = [];
      for (const w of picked) {
        if (selected.length >= 18) break;
        const clean = String(w).trim().toLowerCase();
        if (allowed.has(clean) && !used.has(clean)) {
          used.add(clean);
          selected.push(clean);
        }
      }
      const { month, year } = schedule[i];
      return {
        month,
        year,
        theme: t.theme,
        theme_description: t.description || null,
        words: selected,
        challenge_date: `${year}-${String(month).padStart(2, "0")}-01`,
        challenge_time: "09:00",
        title: `PictoChallenge — ${t.theme}`,
      };
    });

    return json({ challenges });
  } catch (err) {
    console.error("[pictodico-generate-challenges] erreur:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Échec de la génération des challenges", details: message }, 500);
  }
});
