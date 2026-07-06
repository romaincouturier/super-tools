import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SETTING_KEY = "lms_audio_reformulation_prompt";

const DEFAULT_PROMPT_TEMPLATE = `Tu es un assistant pédagogique. Tu reçois la transcription d'enregistrements audio d'une formation, ainsi que la liste des leçons d'un e-learning.

Leçons disponibles :
{{lessons}}

Transcriptions audio :
{{transcripts}}

Pour chaque audio, tu dois :
1. Identifier la leçon la plus pertinente parmi celles listées (en te basant sur le contenu)
2. Si aucune leçon ne correspond clairement, mettre lesson_id à null (le contenu ira dans une leçon "Ressources")
3. Reformuler le contenu de manière claire et pédagogique (style formation professionnelle, sans les hésitations orales)
4. Extraire les 3 à 6 points clés les plus importants

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "assignments": [
    {
      "audio_id": "id de l'audio",
      "lesson_id": "id de la leçon ou null",
      "reformulated_text": "texte reformulé en HTML basique (<p>, <strong>, <em>)",
      "key_points": ["point 1", "point 2", "point 3"]
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
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return createErrorResponse("Erreur lors de l'analyse IA", 500);
    }

    const aiData = await response.json();
    const rawText = aiData.content?.[0]?.text ?? "";

    let parsed: { assignments: AudioAssignment[] };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      console.error("Failed to parse AI response:", rawText);
      return createErrorResponse("Réponse IA non parseable", 500);
    }

    return createJsonResponse(parsed);
  } catch (err) {
    console.error("lms-analyze-audio error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Erreur interne", 500);
  }
});
