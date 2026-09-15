import { supabase } from "@/integrations/supabase/client";
import type { LessonInfo } from "./lmsMediaImport";

export interface TranscriptInput {
  id: string;
  title: string;
  text: string;
}

export interface LessonSection {
  heading: string;
  html: string;
}

export interface ProposedLesson {
  title: string;
  summary_html: string;
  sections: LessonSection[];
  key_points: string[];
  /** Leçon existante à compléter, ou null pour créer une nouvelle leçon. */
  target_lesson_id: string | null;
}

export interface TranscriptProposal {
  transcript_id: string;
  lessons: ProposedLesson[];
}

/**
 * Normalise la réponse IA : ignore les leçons sans contenu utile, garantit les
 * types de chaque champ et écarte les sections vides. Même approche défensive
 * que `normalizeAudioAssignments` : la réponse du modèle n'est jamais fiable.
 */
export function normalizeTranscriptProposals(raw: unknown): TranscriptProposal[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: TranscriptProposal[] = [];

  for (const item of list) {
    const p = item as Record<string, unknown>;
    const transcriptId = typeof p?.transcript_id === "string" ? p.transcript_id : "";
    if (!transcriptId) continue;

    const rawLessons = Array.isArray(p.lessons) ? (p.lessons as unknown[]) : [];
    const lessons: ProposedLesson[] = [];

    for (const l of rawLessons) {
      const lesson = l as Record<string, unknown>;
      const title = typeof lesson.title === "string" ? lesson.title.trim() : "";
      const summary = typeof lesson.summary_html === "string" ? lesson.summary_html.trim() : "";

      const sections: LessonSection[] = (Array.isArray(lesson.sections) ? (lesson.sections as unknown[]) : [])
        .map((s) => {
          const sec = s as Record<string, unknown>;
          return {
            heading: typeof sec?.heading === "string" ? sec.heading.trim() : "",
            html: typeof sec?.html === "string" ? sec.html.trim() : "",
          };
        })
        .filter((s) => s.html);

      const keyPoints = (Array.isArray(lesson.key_points) ? (lesson.key_points as unknown[]) : []).filter(
        (k): k is string => typeof k === "string" && !!k.trim(),
      );

      if (!summary && !sections.length && !keyPoints.length) continue;

      lessons.push({
        title: title || "Leçon sans titre",
        summary_html: summary,
        sections,
        key_points: keyPoints,
        target_lesson_id:
          typeof lesson.target_lesson_id === "string" && lesson.target_lesson_id
            ? lesson.target_lesson_id
            : null,
      });
    }

    if (lessons.length) out.push({ transcript_id: transcriptId, lessons });
  }

  return out;
}

/** Message d'erreur lisible à partir d'un échec `functions.invoke()`. */
async function extractFunctionError(error: unknown, fnName: string): Promise<Error> {
  const err = error as { message?: string; context?: Response };
  let detail = "";
  let status: number | undefined;
  try {
    const ctx = err?.context;
    if (ctx && typeof ctx.clone === "function") {
      status = ctx.status;
      const text = await ctx.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          detail = parsed?.error || parsed?.message || parsed?.details || text;
        } catch (parseErr) {
          console.warn(`[${fnName}] réponse non JSON`, parseErr);
          detail = text;
        }
      }
    }
  } catch (readErr) {
    console.warn(`[${fnName}] lecture de la réponse impossible`, readErr);
  }
  const parts = [`[${fnName}]`];
  if (status) parts.push(`HTTP ${status}`);
  parts.push(detail || err?.message || "Erreur inconnue");
  return new Error(parts.join(" · "));
}

export async function analyzeTranscriptsForLessons(
  transcripts: TranscriptInput[],
  lessons: LessonInfo[],
): Promise<{ proposals: TranscriptProposal[]; failures: string[] }> {
  const { data, error } = await supabase.functions.invoke("lms-analyze-transcript", {
    body: { transcripts, lessons },
  });
  if (error) throw await extractFunctionError(error, "lms-analyze-transcript");

  const payload = data as { proposals?: unknown; failures?: unknown };
  if (!payload?.proposals) throw new Error("Réponse IA invalide : champ 'proposals' manquant");

  return {
    proposals: normalizeTranscriptProposals(payload.proposals),
    failures: Array.isArray(payload.failures)
      ? (payload.failures as unknown[]).filter((f): f is string => typeof f === "string")
      : [],
  };
}

/** Texte complet d'un transcript (`raw_text` est exclu des listes paginées). */
export async function fetchTranscriptText(
  id: string,
): Promise<{ id: string; title: string; text: string } | null> {
  const { data, error } = await supabase
    .from("transcripts")
    .select("id, title, ai_title, raw_text")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; title: string | null; ai_title: string | null; raw_text: string | null };
  if (!row.raw_text || !row.raw_text.trim()) return null;
  return {
    id: row.id,
    title: row.ai_title || row.title || "Transcript sans titre",
    text: row.raw_text,
  };
}

/** Blocs à créer pour une leçon proposée, dans l'ordre d'affichage. */
export function buildLessonBlockContents(lesson: ProposedLesson): { html: string }[] {
  const blocks: { html: string }[] = [];
  if (lesson.summary_html) blocks.push({ html: lesson.summary_html });
  for (const section of lesson.sections) {
    const html = [section.heading ? `<h3>${section.heading}</h3>` : "", section.html]
      .filter(Boolean)
      .join("\n");
    blocks.push({ html });
  }
  if (lesson.key_points.length) {
    blocks.push({
      html: `<h3>À retenir</h3>\n<ul>${lesson.key_points
        .map((kp) => `<li><strong>${kp}</strong></li>`)
        .join("")}</ul>`,
    });
  }
  return blocks;
}
