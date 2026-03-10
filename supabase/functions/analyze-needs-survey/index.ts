import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { surveyIds } = await req.json();

    if (!surveyIds || !Array.isArray(surveyIds) || surveyIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "surveyIds (array) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the surveys
    const { data: surveys, error: qError } = await supabase
      .from("questionnaire_besoins")
      .select(`
        id, nom, prenom, email, societe, fonction,
        competences_visees, experience_sujet, experience_details,
        commentaires_libres, niveau_actuel, niveau_motivation,
        training_id,
        trainings:training_id (training_name)
      `)
      .in("id", surveyIds);

    if (qError) throw new Error("Failed to fetch surveys");
    if (!surveys || surveys.length === 0) {
      return new Response(
        JSON.stringify({ error: "No surveys found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const trainingName = (surveys[0] as any).trainings?.training_name || "Formation";

    const participantData = surveys.map((s: any) => {
      const name = [s.prenom, s.nom].filter(Boolean).join(" ") || "Anonyme";
      return `### ${name}${s.fonction ? ` (${s.fonction})` : ""}${s.societe ? ` — ${s.societe}` : ""}
- Niveau actuel : ${s.niveau_actuel != null ? `${s.niveau_actuel}/5` : "Non renseigné"}
- Motivation : ${s.niveau_motivation != null ? `${s.niveau_motivation}/5` : "Non renseigné"}
- Expérience sur le sujet : ${s.experience_sujet || "Non renseigné"}${s.experience_details ? `\n  Détails : ${s.experience_details}` : ""}
- Compétences visées : ${s.competences_visees || "Non renseigné"}
- Commentaires : ${s.commentaires_libres || "Aucun"}`;
    }).join("\n\n");

    const systemPrompt = `Tu es un expert en ingénierie pédagogique. Tu analyses les recueils de besoins des participants à une formation pour aider le formateur à adapter son intervention.
Réponds en français, de manière structurée et actionnable. Utilise du markdown.`;

    const userPrompt = `Voici les réponses de ${surveys.length} participant(s) pour la formation "${trainingName}".

Focus ton analyse sur : les compétences visées, l'expérience sur le sujet, les commentaires libres, le niveau de motivation et le niveau actuel.

${participantData}

Fournis une analyse structurée :

## 📊 Profil du groupe
- Niveau moyen et dispersion (homogène / hétérogène)
- Motivation générale
- Expérience préalable sur le sujet

## 🎯 Compétences visées
- Synthèse des attentes communes
- Attentes spécifiques ou originales à noter

## 💬 Points saillants des commentaires
- Signaux importants à prendre en compte
- Inquiétudes ou attentes fortes exprimées

## ✅ Recommandations pour le formateur
- Comment adapter le niveau et le rythme
- Points à approfondir ou survoler
- Exercices ou approches pédagogiques suggérés

Sois concis (max 500 mots) et directement exploitable.`;

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const response = await fetch(aiGatewayUrl, {
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
        return new Response(
          JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const analysis = aiResponse.choices?.[0]?.message?.content || "Impossible de générer l'analyse.";

    return new Response(
      JSON.stringify({ analysis, participantCount: surveys.length, trainingName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-needs-survey:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
