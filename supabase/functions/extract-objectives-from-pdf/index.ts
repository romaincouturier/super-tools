import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl } = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching PDF from:", pdfUrl);

    // Fetch the PDF file
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log("PDF fetched, size:", pdfBuffer.byteLength, "bytes");

    // Call Lovable AI Gateway with the PDF
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log("Calling AI Gateway to extract objectives...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es un expert en analyse de programmes de formation. 
            
Ton rôle est d'extraire les objectifs pédagogiques d'un programme de formation PDF.

Instructions:
- Extrait uniquement les objectifs pédagogiques (ce que l'apprenant saura faire à l'issue de la formation)
- Formule chaque objectif de manière concise (une phrase)
- Commence chaque objectif par un verbe d'action à l'infinitif (Comprendre, Maîtriser, Appliquer, Créer, Analyser, etc.)
- Retourne les objectifs sous forme de tableau JSON simple: ["objectif 1", "objectif 2", ...]
- Si tu ne trouves pas d'objectifs clairement identifiés, déduis-les du contenu du programme
- Limite à 10 objectifs maximum, priorise les plus importants
- Retourne UNIQUEMENT le tableau JSON, sans texte additionnel ni markdown`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrait les objectifs pédagogiques de ce programme de formation PDF."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI response received");

    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("Raw AI response:", content);

    // Parse the JSON array from the response
    let objectives: string[];
    try {
      // Remove potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      objectives = JSON.parse(cleanContent);
      
      if (!Array.isArray(objectives)) {
        throw new Error("Response is not an array");
      }
      
      // Ensure all items are strings
      objectives = objectives.filter(item => typeof item === "string" && item.trim().length > 0);
    } catch (parseError) {
      console.error("Failed to parse objectives:", parseError);
      // Fallback: try to extract lines that look like objectives
      objectives = content
        .split("\n")
        .filter((line: string) => line.trim().length > 10)
        .map((line: string) => line.replace(/^[-•*]\s*/, "").trim())
        .slice(0, 10);
    }

    console.log("Extracted objectives:", objectives);

    return new Response(
      JSON.stringify({ objectives }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error extracting objectives:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to extract objectives";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
