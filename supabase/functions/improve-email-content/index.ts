import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ImproveEmailRequest {
  subject: string;
  content: string;
  templateType: string;
  templateName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, content, templateType, templateName }: ImproveEmailRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en rédaction d'emails professionnels en français pour un organisme de formation professionnelle. 
Tu dois améliorer le contenu des emails tout en conservant :
- Le ton professionnel mais chaleureux
- Toutes les variables entre doubles accolades comme {{first_name}}, {{training_name}}, etc.
- La structure conditionnelle avec {{#variable}}...{{/variable}}
- La clarté et la concision

Règles importantes :
- Garde TOUTES les variables {{...}} exactement comme elles sont
- Conserve la structure conditionnelle {{#...}}...{{/...}}
- Améliore le style, la fluidité et l'impact du message
- Garde le message concis mais engageant
- Utilise un ton professionnel mais accessible
- Assure-toi que le message est bien structuré

Retourne UNIQUEMENT le JSON suivant, sans explication ni texte avant ou après :
{
  "subject": "l'objet amélioré",
  "content": "le contenu amélioré"
}`;

    const userPrompt = `Améliore cet email de type "${templateName}" :

OBJET ACTUEL :
${subject}

CONTENU ACTUEL :
${content}

Améliore le style et la formulation tout en gardant toutes les variables {{...}} intactes.`;

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
          JSON.stringify({ error: "Trop de requêtes. Veuillez réessayer dans quelques instants." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédit IA insuffisant. Veuillez ajouter des crédits." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erreur lors de l'appel à l'IA");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("Réponse IA vide");
    }

    // Parse the JSON response from AI
    let improved;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        improved = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiResponse);
      throw new Error("Format de réponse IA invalide");
    }

    return new Response(
      JSON.stringify({
        subject: improved.subject || subject,
        content: improved.content || content,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in improve-email-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
