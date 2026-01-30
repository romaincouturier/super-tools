import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trainingId } = await req.json();

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "trainingId is required" }),
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

    // Fetch training info
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("training_name, objectives, prerequisites")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      throw new Error("Training not found");
    }

    // Fetch all completed questionnaires for this training
    const { data: questionnaires, error: qError } = await supabase
      .from("questionnaire_besoins")
      .select("*")
      .eq("training_id", trainingId)
      .eq("etat", "complete");

    if (qError) {
      throw new Error("Failed to fetch questionnaires");
    }

    if (!questionnaires || questionnaires.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: "Aucun questionnaire complété pour cette formation.",
          recommendations: [],
          participantCount: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a structured summary of responses
    const participantSummaries = questionnaires.map((q) => {
      const name = [q.prenom, q.nom].filter(Boolean).join(" ") || "Anonyme";
      return {
        nom: name,
        experience: q.experience_sujet === "oui" ? "Oui" : "Non",
        experience_details: q.experience_details || null,
        niveau_actuel: q.niveau_actuel,
        niveau_motivation: q.niveau_motivation,
        competences_visees: q.competences_visees,
        prerequis_valides: q.modalites_preferences,
        prerequis_manquants: q.prerequis_details,
        contraintes: q.contraintes_orga,
        besoins_accessibilite: q.besoins_accessibilite,
        commentaires: q.commentaires_libres,
      };
    });

    // Build prompt for AI
    const systemPrompt = `Tu es un assistant pédagogique expert en formation professionnelle. 
Tu analyses les questionnaires de recueil des besoins des participants pour aider le formateur à adapter sa formation.

Réponds en français avec un format structuré et actionnable.`;

    const userPrompt = `Voici les informations de la formation "${training.training_name}":

**Objectifs pédagogiques:**
${training.objectives && training.objectives.length > 0 ? training.objectives.map((o: string) => `- ${o}`).join("\n") : "Non définis"}

**Prérequis:**
${training.prerequisites && training.prerequisites.length > 0 ? training.prerequisites.map((p: string) => `- ${p}`).join("\n") : "Aucun"}

**Réponses des ${questionnaires.length} participant(s):**
${JSON.stringify(participantSummaries, null, 2)}

Analyse ces questionnaires et fournis:

1. **SYNTHÈSE GLOBALE** (3-5 phrases): 
   - Profil général du groupe (niveau, expérience)
   - Points communs dans les attentes
   - Signaux d'attention (prérequis non validés, besoins d'accessibilité)

2. **POINTS CLÉS** (liste à puces):
   - Niveau moyen du groupe
   - Motivations principales
   - Compétences les plus demandées
   - Contraintes ou besoins particuliers

3. **RECOMMANDATIONS D'ADAPTATION** (3-5 conseils concrets):
   - Comment adapter le rythme/niveau
   - Points à approfondir selon les attentes
   - Aménagements à prévoir
   - Exercices ou cas pratiques à privilégier

Sois concis et actionnable.`;

    // Call Lovable AI Gateway
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
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA insuffisants, veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content || "Impossible de générer la synthèse.";

    return new Response(
      JSON.stringify({
        success: true,
        summary: aiContent,
        participantCount: questionnaires.length,
        trainingName: training.training_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating needs summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate summary";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
