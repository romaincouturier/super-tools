import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded, getCorsHeaders, createErrorResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";
import { z, parseBody } from "../_shared/validation.ts";

const requestSchema = z.object({
  action: z.string().min(1),
  content: z.string().min(1),
});

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  const user = await verifyAuth(req.headers.get("authorization"));
  if (!user) return createErrorResponse("Unauthorized", 401, req);

  try {
    const { data, error } = await parseBody(req, requestSchema);
    if (error) return error;

    const { action, content } = data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch brand voice settings from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const settingsRes = await fetch(`${supabaseUrl}/rest/v1/ai_brand_settings?select=setting_type,content`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });

    const settings = await settingsRes.json();
    const supertiltVoice = settings.find((s: any) => s.setting_type === "supertilt_voice")?.content || "";
    const romainVoice = settings.find((s: any) => s.setting_type === "romain_voice")?.content || "";

    let systemPrompt = `Tu es un assistant marketing spécialisé pour SuperTilt, un organisme de formation professionnel.

VOIX DE MARQUE SUPERTILT:
${supertiltVoice || "Professionnelle, accessible, engageante, avec une touche d'humour bienveillant."}

VOIX EDITORIALE DE ROMAIN COUTURIER:
${romainVoice || "Experte mais accessible, partage d'expérience terrain, ton direct et authentique."}

Tu dois adapter le contenu en respectant ces voix selon le contexte.`;

    let userPrompt = "";

    switch (action) {
      case "reformulate":
        userPrompt = `Reformule ce contenu en améliorant le style, la clarté et l'impact tout en conservant le message clé. Utilise la voix de marque SuperTilt.

CONTENU ORIGINAL:
${content}

Réponds uniquement avec le contenu reformulé, sans explication ni introduction.`;
        break;

      case "adapt_blog":
        userPrompt = `Adapte ce contenu pour un article de blog professionnel. Structure-le avec :
- Un titre accrocheur
- Une introduction engageante
- Des sous-titres clairs
- Une conclusion avec appel à l'action

Utilise la voix éditoriale de Romain Couturier.

CONTENU ORIGINAL:
${content}

Réponds uniquement avec l'article adapté.`;
        break;

      case "adapt_linkedin":
        userPrompt = `Adapte ce contenu pour un post LinkedIn professionnel et engageant :
- Accroche percutante en première ligne
- Format aéré avec des retours à la ligne
- Émojis pertinents mais utilisés avec parcimonie
- Appel à l'action ou question finale
- Maximum 1300 caractères

Utilise la voix éditoriale de Romain Couturier.

CONTENU ORIGINAL:
${content}

Réponds uniquement avec le post LinkedIn.`;
        break;

      case "adapt_instagram":
        userPrompt = `Adapte ce contenu pour un post Instagram :
- Texte court et impactant
- Ton plus décontracté
- Émojis bien placés
- Hashtags pertinents à la fin (5-10)
- Maximum 2200 caractères

Utilise la voix de marque SuperTilt avec une touche plus décontractée.

CONTENU ORIGINAL:
${content}

Réponds uniquement avec le post Instagram.`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const result = aiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-content-assist:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
