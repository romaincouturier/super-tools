import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientCompany, synthesis, loomUrl, quoteNumber } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Tu es un expert commercial français. Rédige un email professionnel et chaleureux pour accompagner l'envoi d'un devis.

Contexte :
- Client : ${clientCompany}
- Numéro de devis : ${quoteNumber}
- Synthèse de la demande : ${synthesis || "Non fournie"}
${loomUrl ? `- Vidéo explicative : ${loomUrl}` : ""}

Retourne un JSON avec deux champs :
- "subject": l'objet de l'email (court, professionnel)
- "body": le corps de l'email en texte brut (avec des \\n pour les retours à la ligne)

L'email doit :
- Être personnalisé selon le contexte
- Mentionner que le devis est en pièce jointe
${loomUrl ? "- Mentionner la vidéo explicative avec le lien" : ""}
- Se terminer par une formule de politesse
- NE PAS inclure de signature (elle est ajoutée automatiquement)

Réponds UNIQUEMENT avec le JSON, sans markdown.`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} — ${errText}`);
    }

    const aiData = await response.json();
    const raw = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const cleaned = raw.replace(/```json?\s*\n?/gi, "").replace(/\n?```\s*$/gi, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-quote-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
