import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { program_content, num_questions, question_types, language } = await req.json();

    if (!program_content) {
      return new Response(JSON.stringify({ error: "Le contenu du programme est requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const numQ = num_questions || 10;
    const types = question_types || ["qcm", "vrai_faux", "ouverte"];

    const systemPrompt = `Tu es un expert en évaluation pédagogique. Tu crées des quiz et évaluations pertinents pour vérifier l'acquisition des compétences.
Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks.`;

    const userPrompt = `À partir du programme de formation suivant, génère ${numQ} questions d'évaluation.

Programme :
${typeof program_content === "string" ? program_content : JSON.stringify(program_content)}

Types de questions autorisés : ${types.join(", ")}
Langue : ${language || "Français"}

Retourne un JSON avec cette structure :
{
  "quiz_title": "string",
  "questions": [
    {
      "id": number,
      "type": "qcm" | "vrai_faux" | "ouverte",
      "question": "string",
      "options": ["A", "B", "C", "D"] | null,
      "correct_answer": "string",
      "explanation": "string",
      "difficulty": "facile" | "moyen" | "difficile",
      "linked_objective": "string"
    }
  ]
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
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let quiz;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      quiz = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse quiz response:", content);
      return new Response(JSON.stringify({ error: "Erreur de parsing", raw: content }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ quiz }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-quiz error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
