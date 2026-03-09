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
    const { pdfUrl, extractType = "objectives" } = await req.json();

    if (!pdfUrl) {
      return new Response(
        JSON.stringify({ error: "PDF URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching PDF from:", pdfUrl);
    console.log("Extract type:", extractType);

    // Fetch the PDF file
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }

    // Verify it's actually a PDF
    const contentType = pdfResponse.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !pdfUrl.toLowerCase().endsWith(".pdf")) {
      return new Response(
        JSON.stringify({ error: "L'URL fournie ne pointe pas vers un fichier PDF. Veuillez sélectionner un fichier PDF valide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    if (pdfBuffer.byteLength < 100) {
      return new Response(
        JSON.stringify({ error: "Le fichier PDF est vide ou invalide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Convert to base64 in chunks to avoid stack overflow
    const uint8Array = new Uint8Array(pdfBuffer);
    const CHUNK_SIZE = 8192;
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
      const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pdfBase64 = btoa(binaryString);

    console.log("PDF fetched, size:", pdfBuffer.byteLength, "bytes");

    // Call Lovable AI Gateway with the PDF
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Different prompts based on extract type
    const systemPrompt = extractType === "prerequisites" 
      ? `Tu es un expert en analyse de programmes de formation. 

Ton rôle est d'extraire les prérequis d'un programme de formation PDF.

Instructions:
- Extrait uniquement les prérequis (ce que l'apprenant doit savoir ou maîtriser avant la formation)
- Formule chaque prérequis de manière concise (une phrase)
- Retourne les prérequis sous forme de tableau JSON simple: ["prérequis 1", "prérequis 2", ...]
- Si tu ne trouves pas de prérequis clairement identifiés, déduis-les du contenu du programme
- Limite à 10 prérequis maximum, priorise les plus importants
- Retourne UNIQUEMENT le tableau JSON, sans texte additionnel ni markdown`
      : `Tu es un expert en analyse de programmes de formation. 
            
Ton rôle est d'extraire les objectifs pédagogiques d'un programme de formation PDF.

Instructions:
- Extrait uniquement les objectifs pédagogiques (ce que l'apprenant saura faire à l'issue de la formation)
- Formule chaque objectif de manière concise (une phrase)
- Commence chaque objectif par un verbe d'action à l'infinitif (Comprendre, Maîtriser, Appliquer, Créer, Analyser, etc.)
- Retourne les objectifs sous forme de tableau JSON simple: ["objectif 1", "objectif 2", ...]
- Si tu ne trouves pas d'objectifs clairement identifiés, déduis-les du contenu du programme
- Limite à 10 objectifs maximum, priorise les plus importants
- Retourne UNIQUEMENT le tableau JSON, sans texte additionnel ni markdown`;

    const userPrompt = extractType === "prerequisites"
      ? "Extrait les prérequis de ce programme de formation PDF."
      : "Extrait les objectifs pédagogiques de ce programme de formation PDF.";

    console.log("Calling AI Gateway to extract", extractType, "...");

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiResponse = await fetch(aiGatewayUrl, {
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
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
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
    let items: string[];
    try {
      // Remove potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      items = JSON.parse(cleanContent);
      
      if (!Array.isArray(items)) {
        throw new Error("Response is not an array");
      }
      
      // Ensure all items are strings
      items = items.filter(item => typeof item === "string" && item.trim().length > 0);
    } catch (parseError) {
      console.error("Failed to parse items:", parseError);
      // Fallback: try to extract lines that look like items
      items = content
        .split("\n")
        .filter((line: string) => line.trim().length > 10)
        .map((line: string) => line.replace(/^[-•*]\s*/, "").trim())
        .slice(0, 10);
    }

    console.log("Extracted", extractType, ":", items);

    // Return with appropriate key based on extract type
    const responseData = extractType === "prerequisites" 
      ? { prerequisites: items }
      : { objectives: items };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error extracting content:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to extract content";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
