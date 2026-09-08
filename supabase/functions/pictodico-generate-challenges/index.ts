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
  if (!text || aiData.stop_reason === "max_tokens") {
    console.error(
      "[pictodico-generate-challenges] réponse Anthropic incomplète:",
      JSON.stringify({
        stop_reason: aiData.stop_reason,
        text_length: text.length,
        output_tokens: aiData.usage?.output_tokens,
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
- Si un mot est en anglais, donne sa traduction française dans le champ "fr" (sinon "fr" vaut null).
- Si un thème n'a aucun mot pertinent, retourne un tableau de mots vide.
- Retourne UNIQUEMENT du JSON valide, sans texte avant ni après, sans markdown.`;


  type Entry = { index: number; words: (string | { w?: string; fr?: string | null })[] };
  const extract = (raw: string): Entry[] | null => {
    const direct = parseAiJson<Entry[]>(raw);
    if (Array.isArray(direct)) return direct;
    // Réponse coupée en cours de génération : on récupère les thèmes complets.
    const salvaged = parseTruncatedAiJson<Entry[]>(raw);
    if (Array.isArray(salvaged) && salvaged.length > 0) {
      console.warn(
        `[pictodico-generate-challenges] JSON tronqué récupéré (${salvaged.length} thèmes)`,
      );
      return salvaged;
    }
    return null;
  };

  type ChunkTheme = { index: number; theme: string; description: string; label: string };
  const buildPrompt = (chunk: ChunkTheme[], pool: string[]) =>
    `Thèmes de l'année scolaire ${startYear}-${startYear + 1} à traiter :
${chunk.map((t) => `${t.index}. ${t.label} — ${t.theme}${t.description ? ` : ${t.description}` : ""}`).join("\n")}

Mots collectés encore disponibles (${pool.length}) :
${pool.length > 0 ? pool.join(", ") : "(aucun mot disponible)"}

Retourne un tableau JSON d'objets, un par thème traité, avec l'index exact indiqué ci-dessus :
[{ "index": ${chunk[0].index}, "words": [{ "w": "mot collecté", "fr": null }, { "w": "deadline", "fr": "échéance" }] }]`;


  try {
    const allowed = new Set(uniqueWords);
    const used = new Set<string>();
    const perTheme = new Map<number, string[]>();
    const CHUNK_SIZE = 3;

    // Traitement par petits lots : une réponse par lot reste courte, ce qui évite
    // les réponses tronquées qui laissaient les derniers mois sans mots.
    for (let start = 0; start < cleanThemes.length; start += CHUNK_SIZE) {
      const chunk: ChunkTheme[] = cleanThemes
        .slice(start, start + CHUNK_SIZE)
        .map((t, k) => ({
          index: start + k + 1,
          theme: t.theme,
          description: t.description,
          label: schedule[start + k].label,
        }));

      const pool = uniqueWords.filter((w) => !used.has(w));
      if (pool.length === 0) break;

      const prompt = buildPrompt(chunk, pool);
      let raw = await callAnthropic(systemPrompt, prompt);
      let parsed = extract(raw);

      if (!parsed) {
        raw = await callAnthropic(systemPrompt, `${prompt}\n\n${STRICT_JSON_INSTRUCTION}`);
        parsed = extract(raw);
      }

      if (!parsed) {
        console.error(
          "[pictodico-generate-challenges] réponse IA non parseable:",
          truncateForLog(raw),
        );
        continue;
      }

      chunk.forEach((th, k) => {
        const entry = parsed!.find((p) => Number(p.index) === th.index) ?? parsed![k];
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
        perTheme.set(th.index, selected);
      });
    }

    // Complément : chaque thème est rempli jusqu'à 18 mots avec des mots
    // collectés encore non associés (toujours sans doublon entre thèmes).
    for (let i = 1; i <= cleanThemes.length; i++) {
      const selected = perTheme.get(i) ?? [];
      if (selected.length >= 18) continue;
      for (const w of uniqueWords) {
        if (selected.length >= 18) break;
        if (used.has(w)) continue;
        used.add(w);
        selected.push(w);
      }
      perTheme.set(i, selected);
    }

    const challenges = cleanThemes.map((t, i) => {
      const { month, year } = schedule[i];
      return {
        month,
        year,
        theme: t.theme,
        theme_description: t.description || null,
        words: perTheme.get(i + 1) ?? [],
        challenge_date: `${year}-${String(month).padStart(2, "0")}-01`,
        challenge_time: "12:30",
        title: `PictoChallenge — ${t.theme}`,
      };
    });

    const partial = challenges.some((c) => c.words.length === 0);
    return json({ challenges, partial });
  } catch (err) {
    console.error("[pictodico-generate-challenges] erreur:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: "Échec de la génération des challenges", details: message }, 500);
  }
});
