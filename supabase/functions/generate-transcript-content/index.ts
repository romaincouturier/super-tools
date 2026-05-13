import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface Body {
  transcript_id: string;
  kind: "blog_article" | "linkedin_post";
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

serve(async (req) => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript_id, kind } = (await req.json()) as Body;
    if (!transcript_id || !["blog_article", "linkedin_post"].includes(kind)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();

    // Resolve the calling user
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData?.user?.id ?? null;

    // Fetch transcript
    const { data: transcript, error: tErr } = await supabase
      .from("transcripts")
      .select("id, title, raw_text, summary")
      .eq("id", transcript_id)
      .single();
    if (tErr || !transcript) {
      return new Response(JSON.stringify({ error: "Transcript introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!transcript.raw_text) {
      return new Response(JSON.stringify({ error: "Transcript sans contenu textuel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch prompt config
    const { data: promptCfg, error: pErr } = await supabase
      .from("transcript_ai_prompts")
      .select("system_prompt, user_prompt_template, model")
      .eq("kind", kind)
      .single();
    if (pErr || !promptCfg) {
      return new Response(JSON.stringify({ error: "Prompt non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Supertilt tags
    const { data: tagsRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "supertilt_content_tags")
      .maybeSingle();
    let tagsList: string[] = [];
    try {
      const v = tagsRow?.setting_value;
      tagsList = Array.isArray(v) ? v : JSON.parse(v ?? "[]");
    } catch {
      tagsList = [];
    }
    if (!tagsList.length) {
      tagsList = ["organisation du travail", "intelligence collective", "intelligence artificielle", "facilitation graphique"];
    }

    const userPrompt = applyTemplate(promptCfg.user_prompt_template, {
      transcript: transcript.raw_text.slice(0, 60000),
      title: transcript.title ?? "",
      tags_list: tagsList.join(", "),
    });

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY non configuré" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tool = {
      name: "propose_content",
      description: "Retourne le contenu généré et les tags Supertilt sélectionnés.",
      input_schema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Le contenu rédigé (markdown pour blog, texte plain pour LinkedIn)." },
          title_suggestion: { type: "string", description: "Titre proposé." },
          tags: {
            type: "array",
            items: { type: "string", enum: tagsList },
            description: "1 à 3 tags choisis parmi la liste.",
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ["content", "tags"],
      },
    };

    const anthropicResp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: promptCfg.model || "claude-sonnet-4-6",
        max_tokens: 4096,
        system: promptCfg.system_prompt,
        tools: [tool],
        tool_choice: { type: "tool", name: "propose_content" },
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      console.error("Anthropic error", anthropicResp.status, errText);
      return new Response(JSON.stringify({ error: "Erreur Anthropic", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicResp.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) {
      return new Response(JSON.stringify({ error: "Réponse IA invalide" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { content, title_suggestion, tags } = toolUse.input as {
      content: string;
      title_suggestion?: string;
      tags: string[];
    };

    const filteredTags = (tags || []).filter((t) => tagsList.includes(t));

    const { data: inserted, error: insErr } = await supabase
      .from("transcript_generations")
      .insert({
        transcript_id,
        kind,
        content,
        title_suggestion: title_suggestion ?? null,
        tags: filteredTags,
        model: promptCfg.model,
        created_by: userId,
      })
      .select()
      .single();

    if (insErr) {
      console.error("Insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ generation: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-transcript-content error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
