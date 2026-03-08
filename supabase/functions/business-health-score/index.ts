import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from JWT
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather business metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const isoThirty = thirtyDaysAgo.toISOString();

    // Parallel data fetching
    const [
      trainingsRes,
      participantsRes,
      evaluationsRes,
      questionnairesRes,
      crmRes,
      improvementsRes,
    ] = await Promise.all([
      supabase.from("trainings").select("id, training_name, start_date, end_date, status, created_at").gte("created_at", isoThirty),
      supabase.from("training_participants").select("id, needs_survey_status, evaluation_status, added_at").gte("added_at", isoThirty),
      supabase.from("training_evaluations").select("id, etat, appreciation_generale, training_id").gte("created_at", isoThirty),
      supabase.from("questionnaire_besoins").select("id, etat").gte("created_at", isoThirty),
      supabase.from("crm_cards").select("id, sales_status, estimated_value, won_at, lost_at, created_at").gte("created_at", isoThirty),
      supabase.from("improvements").select("id, status, priority").limit(50),
    ]);

    const trainings = trainingsRes.data || [];
    const participants = participantsRes.data || [];
    const evaluations = evaluationsRes.data || [];
    const questionnaires = questionnairesRes.data || [];
    const crmCards = crmRes.data || [];
    const improvements = improvementsRes.data || [];

    // Compute metrics
    const totalParticipants = participants.length;
    const surveyCompleted = questionnaires.filter(q => q.etat === "soumis").length;
    const surveyTotal = questionnaires.length;
    const evalCompleted = evaluations.filter(e => e.etat === "soumis").length;
    const evalTotal = evaluations.length;
    const avgSatisfaction = evaluations
      .filter(e => e.appreciation_generale != null)
      .reduce((acc, e) => acc + (e.appreciation_generale || 0), 0) / (evaluations.filter(e => e.appreciation_generale != null).length || 1);
    const wonDeals = crmCards.filter(c => c.won_at).length;
    const lostDeals = crmCards.filter(c => c.lost_at).length;
    const pipeline = crmCards.filter(c => !c.won_at && !c.lost_at).reduce((acc, c) => acc + (c.estimated_value || 0), 0);
    const openImprovements = improvements.filter(i => i.status !== "done").length;

    const metricsContext = `
Métriques business des 30 derniers jours :
- Formations actives : ${trainings.length}
- Nouveaux participants : ${totalParticipants}
- Questionnaires besoins : ${surveyCompleted}/${surveyTotal} complétés (${surveyTotal > 0 ? Math.round(surveyCompleted/surveyTotal*100) : 0}%)
- Évaluations à chaud : ${evalCompleted}/${evalTotal} complétées (${evalTotal > 0 ? Math.round(evalCompleted/evalTotal*100) : 0}%)
- Satisfaction moyenne : ${avgSatisfaction.toFixed(1)}/5
- CRM : ${wonDeals} deals gagnés, ${lostDeals} perdus, ${pipeline}€ en pipeline
- Améliorations ouvertes : ${openImprovements}
- Participants sans questionnaire complété : ${participants.filter(p => p.needs_survey_status !== "complete").length}
- Participants sans évaluation : ${participants.filter(p => p.evaluation_status !== "complete").length}
`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Tu es un consultant expert en gestion d'organismes de formation. Tu analyses les métriques business et fournis des recommandations concrètes et actionnables.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`,
          },
          {
            role: "user",
            content: `Analyse ces métriques et génère un rapport de santé business :

${metricsContext}

Retourne un JSON :
{
  "health_score": number (0-100),
  "health_label": "critique" | "attention" | "bon" | "excellent",
  "summary": "string (2-3 phrases)",
  "dropout_risks": [
    { "description": "string", "severity": "high" | "medium" | "low", "action": "string" }
  ],
  "recommendations": [
    { "title": "string", "description": "string", "priority": "high" | "medium" | "low", "category": "commercial" | "pedagogique" | "qualite" | "operationnel" }
  ],
  "strengths": ["string"],
  "kpis": {
    "completion_rate": number,
    "satisfaction_score": number,
    "conversion_rate": number,
    "pipeline_value": number
  }
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let report;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      report = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "Erreur parsing IA", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report, metrics: { trainings: trainings.length, participants: totalParticipants, surveyRate: surveyTotal > 0 ? Math.round(surveyCompleted/surveyTotal*100) : 0, evalRate: evalTotal > 0 ? Math.round(evalCompleted/evalTotal*100) : 0, pipeline } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("business-health error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
