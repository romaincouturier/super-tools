import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface MonthSchedule {
  month: number;
  year: number;
  label: string;
  season: string;
  seasonalContext: string;
}

function buildSchedule(startYear: number): MonthSchedule[] {
  return [
    { month: 9,  year: startYear,     label: `Septembre ${startYear}`,     season: "automne",   seasonalContext: "rentrée scolaire, nouvelles rencontres, organisation" },
    { month: 10, year: startYear,     label: `Octobre ${startYear}`,       season: "automne",   seasonalContext: "automne, Halloween, couleurs de la forêt, récolte" },
    { month: 11, year: startYear,     label: `Novembre ${startYear}`,      season: "automne",   seasonalContext: "famille, maison, chaleur, souvenir" },
    { month: 12, year: startYear,     label: `Décembre ${startYear}`,      season: "hiver",     seasonalContext: "Noël, fêtes de fin d'année, cadeaux, neige" },
    { month: 1,  year: startYear + 1, label: `Janvier ${startYear + 1}`,   season: "hiver",     seasonalContext: "nouvelle année, résolutions, froid, hibernation" },
    { month: 2,  year: startYear + 1, label: `Février ${startYear + 1}`,   season: "hiver",     seasonalContext: "amour, Saint-Valentin, amitié, douceur" },
    { month: 3,  year: startYear + 1, label: `Mars ${startYear + 1}`,      season: "printemps", seasonalContext: "printemps, réveil de la nature, croissance, couleurs" },
    { month: 4,  year: startYear + 1, label: `Avril ${startYear + 1}`,     season: "printemps", seasonalContext: "Pâques, jardin, animaux bébés, pluie" },
    { month: 5,  year: startYear + 1, label: `Mai ${startYear + 1}`,       season: "printemps", seasonalContext: "fleurs, plein air, sport, famille, fête des mères" },
    { month: 6,  year: startYear + 1, label: `Juin ${startYear + 1}`,      season: "été",       seasonalContext: "fin d'année, vacances, été, soleil, mer ou montagne" },
  ];
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify user auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { words: string[]; startYear: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { words, startYear } = body;

  if (!words || !Array.isArray(words)) {
    return new Response(JSON.stringify({ error: "words must be an array" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!startYear || typeof startYear !== "number") {
    return new Response(JSON.stringify({ error: "startYear must be a number" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deduplicate and clean words
  const uniqueWords = [
    ...new Set(words.map((w) => w.trim().toLowerCase()).filter((w) => w.length > 1)),
  ];

  const schedule = buildSchedule(startYear);

  const systemPrompt = `Tu es un expert en orthophonie et en communication alternative et augmentée (CAA) pour le site picto-dico.fr, spécialisé dans les pictogrammes.

Tu dois créer 10 PictoChallenges mensuels pour une année scolaire (septembre à juin).
Chaque PictoChallenge est un défi mensuel pour illustrer un thème avec des pictogrammes.

RÈGLES ABSOLUES :
- Exactement 10 challenges (un par mois)
- Chaque challenge : entre 15 et 18 mots INCLUS (jamais moins de 15, jamais plus de 18)
- Mix OBLIGATOIRE dans chaque challenge : au moins 6 mots concrets (objets, animaux, lieux, aliments, vêtements, actions physiques) ET au moins 4 mots abstraits (émotions, sentiments, concepts, qualités morales, états d'esprit)
- Tenir compte du contexte saisonnier et des événements culturels de chaque mois
- Les mots doivent être pertinents pour la communication quotidienne et l'orthophonie
- Utiliser les mots collectés fournis EN PRIORITÉ, compléter si nécessaire avec des mots pertinents
- Ignorer les mots trop obscurs, les noms propres, les fautes d'orthographe évidentes
- Chaque thème doit être original et distinctif des autres mois
- Retourner UNIQUEMENT du JSON valide, sans texte avant ni après, sans markdown`;

  const scheduleText = schedule
    .map((s) => `- ${s.label} (${s.season}) : ${s.seasonalContext}`)
    .join("\n");

  const userPrompt = `Génère les 10 PictoChallenges pour l'année scolaire ${startYear}-${startYear + 1}.

Mots collectés par les utilisateurs (${uniqueWords.length} mots uniques) :
${uniqueWords.length > 0 ? uniqueWords.join(", ") : "(aucun mot collecté - utilise des mots pertinents pour chaque thème)"}

Planning mensuel et contexte saisonnier :
${scheduleText}

Retourne un tableau JSON de 10 objets avec cette structure exacte :
[
  {
    "month": 9,
    "year": ${startYear},
    "theme": "Titre du thème",
    "words": ["mot1", "mot2", ..., "mot16"]
  }
]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_ADVANCED,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.content?.[0]?.text || "";

    let challenges: Array<{ month: number; year: number; theme: string; words: string[] }>;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array in response");
      challenges = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON:", content.slice(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize and validate each challenge
    const normalized = challenges.map((c) => {
      const words = Array.isArray(c.words)
        ? c.words.map((w: string) => String(w).trim().toLowerCase()).filter(Boolean).slice(0, 18)
        : [];
      return {
        month: Number(c.month),
        year: Number(c.year),
        theme: String(c.theme || ""),
        words,
        challenge_date: `${c.year}-${String(c.month).padStart(2, "0")}-01`,
        title: `PictoChallenge ${String(c.month).padStart(2, "0")}/${c.year} — ${c.theme}`,
      };
    });

    return new Response(JSON.stringify({ challenges: normalized }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal error", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
