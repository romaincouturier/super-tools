import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { logLovableUsage } from "../_shared/api-usage.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { trainingId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = getSupabaseClient();

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

    // Cold evaluations (participants and sponsors), submitted only.
    let pcq = supabase
      .from("participant_cold_evaluations")
      .select("training_name, mise_en_pratique, frequence_utilisation, exemple_application, niveau_maitrise, freins, freins_details, effets_constates, objectifs_atteints, besoins_complementaires, recommandation, commentaires_libres")
      .eq("etat", "soumis");
    let scq = supabase
      .from("sponsor_cold_evaluations")
      .select("training_name, satisfaction_globale, attentes_satisfaites, objectifs_atteints, impact_competences, description_impact, recommandation, points_forts, axes_amelioration, commentaires_libres")
      .eq("etat", "soumis");
    // Free-form feedback received by email, phone or orally, outside questionnaires.
    let fbq = supabase
      .from("training_feedbacks")
      .select("author_role, source, received_at, content")
      .order("received_at", { ascending: false })
      .limit(200);
    if (trainingId) {
      pcq = pcq.eq("training_id", trainingId);
      scq = scq.eq("training_id", trainingId);
      fbq = fbq.eq("training_id", trainingId);
    }
    const [{ data: participantCold }, { data: sponsorCold }, { data: freeFeedbacks }] = await Promise.all([pcq, scq, fbq]);
    const coldSection = (participantCold?.length || sponsorCold?.length)
      ? `

Évaluations à froid des participants (mise en pratique, quelques semaines après) :
${JSON.stringify(participantCold || [], null, 2)}

Évaluations à froid des commanditaires :
${JSON.stringify(sponsorCold || [], null, 2)}`
      : "";
    const feedbackSection = freeFeedbacks?.length
      ? `

Retours libres reçus hors questionnaire (email, téléphone, oral) :
${JSON.stringify(freeFeedbacks, null, 2)}`
      : "";

    const totalCount = (evaluations?.length || 0) + (participantCold?.length || 0) + (sponsorCold?.length || 0) + (freeFeedbacks?.length || 0);
    if (totalCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Aucune évaluation ni aucun retour trouvé",
          analysis: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get training info
    let trainingName = "Toutes les formations";
    if (trainingId) {
      trainingName = evaluations?.[0]?.trainings?.training_name;
      if (!trainingName) {
        const { data: t } = await supabase.from("trainings").select("training_name").eq("id", trainingId).maybeSingle();
        trainingName = t?.training_name || "la formation";
      }
    }

    // Prepare evaluation summaries for AI
    const evalSummaries = (evaluations || []).map((e) => ({
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

    const userPrompt = `Analyse ces ${totalCount} évaluations et retours pour ${trainingName} (${evalSummaries.length} évaluations à chaud) :

${JSON.stringify(evalSummaries, null, 2)}${coldSection}${feedbackSection}

Génère une analyse structurée avec points forts, points faibles et recommandations d'amélioration.`;

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
          JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans quelques instants." }),
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
    await logLovableUsage({
      origin: "analyze-evaluations",
      trigger: "user",
      data: aiResponse,
    });
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
        evaluations_count: totalCount,
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
          evaluationsCount: totalCount,
          trainingName,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error analyzing evaluations:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze evaluations";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
