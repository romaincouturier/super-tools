import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";
import { logAnthropicUsage } from "../_shared/api-usage.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SETTING_KEY = "lms_audio_reformulation_prompt";

const DEFAULT_PROMPT_TEMPLATE = `Tu es un assistant pédagogique. Tu reçois la transcription d'enregistrements audio d'une formation, ainsi que la liste des leçons d'un e-learning.

Leçons disponibles :
{{lessons}}

Transcriptions audio :
{{transcripts}}

Pour chaque audio, tu dois :
1. Détecter si l'enregistrement traite d'un seul sujet ou de plusieurs sujets distincts correspondant à des leçons différentes.
2. Découper l'audio en segments thématiques : un segment par sujet réellement distinct. Si l'audio ne traite qu'un seul sujet, renvoie un seul segment. Ne découpe jamais artificiellement un propos continu.
3. Pour chaque segment : identifier la leçon la plus pertinente parmi celles listées. Si aucune ne correspond clairement, mettre lesson_id à null (le contenu ira dans une leçon "Ressources").
4. Pour chaque segment : reformuler le contenu de manière claire et pédagogique (style formation professionnelle, sans les hésitations orales) et extraire 3 à 6 points clés.
5. Donner à chaque segment un titre court qui résume son sujet.
6. Ne pas dupliquer un passage dans deux segments : chaque partie de la transcription appartient à un seul segment, dans l'ordre de l'enregistrement.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "assignments": [
    {
      "audio_id": "id de l'audio",
      "segments": [
        {
          "title": "titre court du segment",
          "lesson_id": "id de la leçon ou null",
          "reformulated_text": "texte reformulé en HTML basique (<p>, <strong>, <em>)",
          "key_points": ["point 1", "point 2", "point 3"]
        }
      ]
    }
  ]
}`;

async function loadPromptTemplate(): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return DEFAULT_PROMPT_TEMPLATE;
    const admin = createClient(url, key);
    const { data } = await admin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();
    const raw = data?.setting_value;
    const value = typeof raw === "string" ? raw : (raw as any)?.value;
    if (typeof value === "string" && value.trim().length > 0) return value;
    return DEFAULT_PROMPT_TEMPLATE;
  } catch (e) {
    console.warn("[lms-analyze-audio] falling back to default prompt:", e);
    return DEFAULT_PROMPT_TEMPLATE;
  }
}

interface AudioTranscript {
  id: string;
  file_name: string;
  text: string;
}

interface LessonInfo {
  id: string;
  title: string;
  module_title: string;
}

interface AudioAssignment {
  audio_id: string;
  lesson_id: string | null; // null = créer/utiliser leçon "Ressources"
  reformulated_text: string;
  key_points: string[];
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    if (!ANTHROPIC_API_KEY) return createErrorResponse("ANTHROPIC_API_KEY not configured", 500);

    const { transcripts, lessons }: { transcripts: AudioTranscript[]; lessons: LessonInfo[] } = await req.json();

    if (!transcripts?.length) return createErrorResponse("Aucun transcript fourni", 400);
    if (!lessons?.length) return createErrorResponse("Aucune leçon fournie", 400);

    const lessonsBlock = lessons
      .map((l) => `- [${l.id}] "${l.title}" (module: ${l.module_title})`)
      .join("\n");

    const transcriptsBlock = transcripts
      .map((t) => `=== Audio: ${t.file_name} (id: ${t.id}) ===\n${t.text}`)
      .join("\n\n");

    const template = await loadPromptTemplate();
    const prompt = template
      .replaceAll("{{lessons}}", lessonsBlock)
      .replaceAll("{{transcripts}}", transcriptsBlock);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_ADVANCED,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return createErrorResponse("Erreur lors de l'analyse IA", 500);
    }

    const aiData = await response.json();
    await logAnthropicUsage({
      origin: "lms-analyze-audio",
      operation: "analyze",
      model: CLAUDE_ADVANCED,
      trigger: "user",
      usage: aiData.usage,
    });
    const rawText: string = (Array.isArray(aiData.content) ? aiData.content : [])
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("")
      .trim();

    if (!rawText) {
      console.error(
        "Empty AI response, stop_reason:",
        aiData.stop_reason,
        "content types:",
        JSON.stringify((aiData.content ?? []).map((b: any) => b?.type)),
      );
      return createErrorResponse(
        aiData.stop_reason === "max_tokens"
          ? "Analyse trop longue pour l'IA : importez moins d'audios à la fois."
          : "L'IA n'a renvoyé aucun contenu, réessayez.",
        500,
      );
    }

    let parsed: { assignments: AudioAssignment[] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      console.error("Failed to parse AI response (len " + rawText.length + "):", rawText.slice(0, 2000));
      return createErrorResponse(
        aiData.stop_reason === "max_tokens"
          ? "Analyse trop longue pour l'IA : importez moins d'audios à la fois."
          : "Réponse IA non parseable",
        500,
      );
    }

    return createJsonResponse(parsed);
  } catch (err) {
    console.error("lms-analyze-audio error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Erreur interne", 500);
  }
});
