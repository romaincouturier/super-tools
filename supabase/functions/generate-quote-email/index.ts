import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    
    // Clean markdown fences
    let cleaned = raw.replace(/```json?\s*\n?/gi, "").replace(/\n?```\s*$/gi, "").trim();

    let parsed: { subject: string; body: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object from the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        // Try to repair truncated JSON: ensure closing brace
        if (!jsonStr.endsWith("}")) {
          // Find last complete value and close
          const lastQuote = jsonStr.lastIndexOf('"');
          if (lastQuote > 0) {
            jsonStr = jsonStr.substring(0, lastQuote + 1) + "}";
          }
        }
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          // Last resort: extract subject and body with regex
          const subjectMatch = cleaned.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const bodyMatch = cleaned.match(/"body"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/);
          parsed = {
            subject: subjectMatch ? subjectMatch[1].replace(/\\"/g, '"') : `Devis ${clientCompany}`,
            body: bodyMatch
              ? bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n")
              : `Bonjour,\n\nVeuillez trouver ci-joint notre devis ${quoteNumber}.\n\nCordialement`,
          };
        }
      } else {
        // No JSON found at all — generate fallback
        parsed = {
          subject: `Votre devis ${quoteNumber} — ${clientCompany}`,
          body: `Bonjour,\n\nSuite à nos échanges, veuillez trouver ci-joint notre devis n°${quoteNumber}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement`,
        };
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-quote-email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
