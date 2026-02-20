import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded, getCorsHeaders } from "../_shared/cors.ts";
import { z, parseBody } from "../_shared/validation.ts";

const requestSchema = z.object({
  trainingId: z.string().uuid().optional(),
});

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { data, error } = await parseBody(req, requestSchema);
    if (error) return error;

    const { trainingId } = data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user from request
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Build query for evaluations
    let query = supabase
      .from("training_evaluations")
      .select(`
        *,
        trainings!inner(id, training_name, objectives)
      `)
      .eq("etat", "soumis");

    if (trainingId) {
      query = query.eq("training_id", trainingId);
    }

    const { data: evaluations, error: evalError } = await query;

    if (evalError) {
      throw new Error(`Failed to fetch evaluations: ${evalError.message}`);
    }

    if (!evaluations || evaluations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Aucune évaluation complète trouvée",
          analysis: null,
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get training info
    const trainingName = trainingId 
      ? evaluations[0]?.trainings?.training_name 
      : "Toutes les formations";

    // Prepare evaluation summaries for AI
    const evalSummaries = evaluations.map((e) => ({
      formation: e.trainings?.training_name,
      appreciation_generale: e.appreciation_generale,
      recommandation: e.recommandation,
      message_recommandation: e.message_recommandation,
      objectifs_evaluation: e.objectifs_evaluation,
      rythme: e.rythme,
      equilibre_theorie_pratique: e.equilibre_theorie_pratique,
      amelioration_suggeree: e.amelioration_suggeree,
      freins_application: e.freins_application,
      remarques_libres: e.remarques_libres,
      conditions_info_satisfaisantes: e.conditions_info_satisfaisantes,
      formation_adaptee_public: e.formation_adaptee_public,
      qualification_intervenant_adequate: e.qualification_intervenant_adequate,
    }));

    const systemPrompt = `Tu es un expert en analyse de formations professionnelles.
Tu analyses les évaluations des participants pour identifier les points forts, les points faibles et proposer des recommandations d'amélioration concrètes et actionnables.

Réponds UNIQUEMENT en JSON valide avec la structure suivante:
{
  "summary": "Résumé général de l'analyse en 2-3 phrases",
  "strengths": [
    {"title": "Titre court", "description": "Description détaillée du point fort", "evidence": "Citation ou donnée issue des évaluations"}
  ],
  "weaknesses": [
    {"title": "Titre court", "description": "Description du point faible identifié", "evidence": "Citation ou donnée issue des évaluations"}
  ],
  "recommendations": [
    {"title": "Titre de l'amélioration", "description": "Description détaillée de l'action à entreprendre", "priority": "high|medium|low", "impact": "Description de l'impact attendu"}
  ]
}

IMPORTANT:
- Fournis 3 à 5 éléments par catégorie
- Sois spécifique et actionnable dans les recommandations
- Base-toi uniquement sur les données fournies
- Les titres doivent être courts (max 10 mots)
- Les descriptions doivent être détaillées mais concises`;

    const userPrompt = `Analyse ces ${evaluations.length} évaluations pour ${trainingName}:

${JSON.stringify(evalSummaries, null, 2)}

Génère une analyse structurée avec points forts, points faibles et recommandations d'amélioration.`;

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
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content || "";

    // Parse AI response
    let analysis;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      throw new Error("Failed to parse AI analysis");
    }

    // Store the analysis in the database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from("evaluation_analyses")
      .insert({
        training_id: trainingId || null,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        recommendations: analysis.recommendations || [],
        summary: analysis.summary || "",
        evaluations_count: evaluations.length,
        created_by: userId,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Failed to save analysis:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          id: savedAnalysis?.id,
          ...analysis,
          evaluationsCount: evaluations.length,
          trainingName,
        },
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error analyzing evaluations:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze evaluations";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
