import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, objectives, sector, duration_hours, language } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Le titre est requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Tu es un ingénieur pédagogique expert en conception de programmes de formation professionnelle.
Tu génères des programmes complets, structurés et conformes aux exigences Qualiopi.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`;

    const userPrompt = `Génère un programme de formation complet avec ces paramètres :
- Titre : "${title}"
- Objectifs : ${objectives ? `"${objectives}"` : "À définir selon le titre"}
- Secteur : ${sector || "Général"}
- Durée : ${duration_hours || 7} heures
- Langue : ${language || "Français"}

Retourne un JSON avec cette structure exacte :
{
  "program_title": "string",
  "objectives": ["objectif 1", "objectif 2", ...],
  "prerequisites": ["prérequis 1", ...],
  "target_audience": "string",
  "pedagogical_methods": ["méthode 1", ...],
  "evaluation_methods": ["méthode 1", ...],
  "modules": [
    {
      "title": "string",
      "duration_minutes": number,
      "content": ["point 1", "point 2", ...],
      "activities": ["activité 1", ...]
    }
  ],
  "materials_needed": ["matériel 1", ...],
  "accessibility_info": "string",
  "certification_info": "string"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle potential markdown wrapping)
    let program;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      program = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Erreur de parsing de la réponse IA", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ program }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-training-program error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
