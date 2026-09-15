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
import { parseAiJson, truncateForLog, STRICT_JSON_INSTRUCTION } from "../_shared/ai-json.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SETTING_KEY = "lms_transcript_lesson_prompt";

/** Au-delà de cette taille, le transcript est découpé en tronçons analysés séparément. */
const MAX_CHARS_PER_CHUNK = 45000;

const DEFAULT_PROMPT_TEMPLATE = `Tu es un concepteur pédagogique. Tu reçois la transcription d'un échange (réunion, atelier, formation) et la liste des leçons déjà existantes d'un parcours e-learning.

Leçons existantes :
{{lessons}}

Transcriptions :
{{transcripts}}

Pour chaque transcription, tu dois :
1. Identifier les sujets réellement distincts et découper la matière en leçons cohérentes (1 à 6 leçons selon la richesse du contenu). Ne découpe jamais artificiellement un propos continu.
2. Donner à chaque leçon un titre court et explicite.
3. Rédiger pour chaque leçon une introduction de 2 à 4 phrases (HTML basique).
4. Structurer le corps de la leçon en 2 à 5 sections, chacune avec un intertitre et un texte reformulé de manière claire et pédagogique (style formation professionnelle, sans hésitations orales, sans marques d'oralité, sans nom de participant).
5. Extraire 3 à 6 points clés à retenir.
6. Si la leçon complète clairement une leçon existante, renseigner target_lesson_id avec son id ; sinon mettre null (une nouvelle leçon sera créée).
7. Ne jamais dupliquer un passage dans deux leçons.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "proposals": [
    {
      "transcript_id": "id de la transcription",
      "lessons": [
        {
          "title": "titre de la leçon",
          "summary_html": "<p>introduction</p>",
          "sections": [
            { "heading": "intertitre", "html": "<p>texte reformulé</p>" }
          ],
          "key_points": ["point 1", "point 2", "point 3"],
          "target_lesson_id": null
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = typeof raw === "string" ? raw : (raw as any)?.value;
    if (typeof value === "string" && value.trim().length > 0) return value;
    return DEFAULT_PROMPT_TEMPLATE;
  } catch (e) {
    console.warn("[lms-analyze-transcript] falling back to default prompt:", e);
    return DEFAULT_PROMPT_TEMPLATE;
  }
}

interface TranscriptInput {
  id: string;
  title: string;
  text: string;
}

interface LessonInfo {
  id: string;
  title: string;
  module_title: string;
}

interface LessonProposal {
  title: string;
  summary_html: string;
  sections: { heading: string; html: string }[];
  key_points: string[];
  target_lesson_id: string | null;
}

interface Proposal {
  transcript_id: string;
  lessons: LessonProposal[];
}

/**
 * Découpe un texte long en tronçons sur des frontières de paragraphe, afin de
 * ne jamais dépasser la fenêtre du modèle sur un transcript de plusieurs heures.
 */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && current.length + p.length + 2 > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (p.length > maxChars) {
      // Paragraphe monolithique : découpage brut.
      for (let i = 0; i < p.length; i += maxChars) chunks.push(p.slice(i, i + maxChars));
      continue;
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) chunks.push(current);
  return chunks;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    if (!ANTHROPIC_API_KEY) return createErrorResponse("ANTHROPIC_API_KEY not configured", 500);

    const { transcripts, lessons }: { transcripts: TranscriptInput[]; lessons: LessonInfo[] } =
      await req.json();

    const usable = (transcripts ?? []).filter((t) => t?.id && typeof t.text === "string" && t.text.trim());
    if (!usable.length) return createErrorResponse("Aucun transcript exploitable fourni", 400);

    const lessonsBlock = (lessons ?? []).length
      ? lessons.map((l) => `- [${l.id}] "${l.title}" (module: ${l.module_title})`).join("\n")
      : "(aucune leçon existante — toutes les leçons proposées seront créées)";

    const template = await loadPromptTemplate();

    async function callAi(userContent: string) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_ADVANCED,
          max_tokens: 16000,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("[lms-analyze-transcript] Anthropic error:", response.status, err);
        return { ok: false as const, status: response.status };
      }

      const aiData = await response.json();
      await logAnthropicUsage({
        origin: "lms-analyze-transcript",
        operation: "analyze",
        model: CLAUDE_ADVANCED,
        trigger: "user",
        usage: aiData.usage,
      });
      const text: string = (Array.isArray(aiData.content) ? aiData.content : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b?.type === "text" && typeof b.text === "string")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("")
        .trim();
      return { ok: true as const, text, stopReason: aiData.stop_reason as string | undefined };
    }

    async function analyzeChunk(t: TranscriptInput, chunk: string, part: number, total: number) {
      const label = total > 1 ? `${t.title} (partie ${part}/${total})` : t.title;
      const transcriptsBlock = `=== Transcript : ${label} (id: ${t.id}) ===\n${chunk}`;
      const prompt = template
        .replaceAll("{{lessons}}", lessonsBlock)
        .replaceAll("{{transcripts}}", transcriptsBlock);

      let attempt = await callAi(prompt);
      if (!attempt.ok) return null;

      let parsed = parseAiJson<{ proposals: Proposal[] }>(attempt.text);
      if (!parsed || !Array.isArray(parsed.proposals)) {
        console.error(
          "[lms-analyze-transcript] unparseable response (stop_reason:",
          attempt.stopReason,
          "):",
          truncateForLog(attempt.text),
        );
        const retry = await callAi(`${prompt}\n\n${STRICT_JSON_INSTRUCTION}`);
        if (!retry.ok) return null;
        parsed = parseAiJson<{ proposals: Proposal[] }>(retry.text);
        if (!parsed || !Array.isArray(parsed.proposals)) {
          console.error(
            "[lms-analyze-transcript] retry also unparseable (stop_reason:",
            retry.stopReason,
            "):",
            truncateForLog(retry.text),
          );
          return null;
        }
      }
      return parsed.proposals;
    }

    const byTranscript = new Map<string, LessonProposal[]>();
    const failures: string[] = [];

    for (const t of usable) {
      const chunks = chunkText(t.text.trim(), MAX_CHARS_PER_CHUNK);
      const collected: LessonProposal[] = [];
      let chunkFailed = false;

      for (let i = 0; i < chunks.length; i++) {
        const proposals = await analyzeChunk(t, chunks[i], i + 1, chunks.length);
        if (!proposals) {
          chunkFailed = true;
          continue;
        }
        for (const p of proposals) {
          if (Array.isArray(p?.lessons)) collected.push(...p.lessons);
        }
      }

      if (collected.length) byTranscript.set(t.id, collected);
      else if (chunkFailed) failures.push(t.title || t.id);
    }

    if (!byTranscript.size) {
      return createErrorResponse(
        "L'IA n'a pas réussi à structurer ces transcripts. Réessayez, ou traitez-les un par un.",
        422,
      );
    }

    return createJsonResponse({
      proposals: Array.from(byTranscript.entries()).map(([transcript_id, lessons]) => ({
        transcript_id,
        lessons,
      })),
      failures,
    });
  } catch (err) {
    console.error("lms-analyze-transcript error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Erreur interne", 500);
  }
});
