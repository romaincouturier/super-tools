import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, content, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!content || !action) {
      return new Response(
        JSON.stringify({ error: "Missing content or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Fetch calling user's editorial voice from profiles
    let userVoice = "";
    if (userId) {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=voice_description&user_id=eq.${userId}`,
        {
          headers: {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
        }
      );
      const profiles = await profileRes.json();
      userVoice = profiles?.[0]?.voice_description || "";
    }

    // Prefer per-user voice_description, fall back to romain_voice from ai_brand_settings
    const editorialVoice = userVoice || romainVoice || "Experte mais accessible, partage d'expérience terrain, ton direct et authentique.";

    let systemPrompt = `Tu es un assistant marketing spécialisé pour SuperTilt, un organisme de formation professionnel.

VOIX DE MARQUE SUPERTILT:
${supertiltVoice || "Professionnelle, accessible, engageante, avec une touche d'humour bienveillant."}

VOIX ÉDITORIALE DE L'UTILISATEUR:
${editorialVoice}

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

Utilise la voix éditoriale de l'utilisateur.

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

Utilise la voix éditoriale de l'utilisateur.

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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const response = await fetch(aiGatewayUrl, {
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-content-assist:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
