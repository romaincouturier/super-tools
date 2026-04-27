/**
 * Stage 1 of the lesson blocks refactor (ST-2026-0040).
 *
 * Each lesson exposes an ordered list of typed content blocks.
 * Block content lives in a JSONB column; each type defines its own shape.
 *
 * The set of types here intentionally matches the legacy lesson_type strings
 * so existing rows can be backfilled into a single block of the same type.
 * Editors for the remaining types ship in Stage 2/3.
 */

export type LessonBlockType =
  | "text"
  | "video"
  | "image"
  | "file"
  | "quiz"
  | "assignment"
  | "callout"
  | "key_points"
  | "checklist"
  | "button"
  | "exercise"
  | "self_assessment";

export interface TextBlockContent {
  html: string;
}

export interface VideoBlockContent {
  url: string | null;
  duration_seconds?: number | null;
}

export interface ImageBlockContent {
  url: string | null;
  caption_html?: string | null;
}

export interface FileBlockContent {
  url: string | null;
  name?: string | null;
  size?: number | null;
  description_html?: string | null;
}

export interface QuizBlockContent {
  quiz_id: string | null;
}

export interface AssignmentBlockContent {
  assignment_id: string | null;
  instructions_html?: string | null;
}

export type CalloutColor = "blue" | "amber" | "green" | "red" | "gray";

export interface CalloutBlockContent {
  color: CalloutColor;
  title?: string | null;
  body_html: string;
}

export interface KeyPointsBlockContent {
  title?: string | null;
  items: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistBlockContent {
  title?: string | null;
  items: ChecklistItem[];
}

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonBlockContent {
  label: string;
  url: string;
  variant: ButtonVariant;
  open_in_new_tab: boolean;
}

export interface ExerciseBlockContent {
  prompt_html: string;
  answer_html?: string | null;
}

export type SelfAssessmentScale = "stars" | "labels";

export interface SelfAssessmentBlockContent {
  prompt: string;
  scale: SelfAssessmentScale;
  labels?: string[];
}

export type LessonBlockContent =
  | TextBlockContent
  | VideoBlockContent
  | ImageBlockContent
  | FileBlockContent
  | QuizBlockContent
  | AssignmentBlockContent
  | CalloutBlockContent
  | KeyPointsBlockContent
  | ChecklistBlockContent
  | ButtonBlockContent
  | ExerciseBlockContent
  | SelfAssessmentBlockContent;

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: LessonBlockType;
  position: number;
  hidden: boolean;
  content: LessonBlockContent;
  created_at: string;
  updated_at: string;
}

export interface CreateLessonBlockInput {
  lesson_id: string;
  type: LessonBlockType;
  position: number;
  content: LessonBlockContent;
}

export interface UpdateLessonBlockInput {
  type?: LessonBlockType;
  position?: number;
  hidden?: boolean;
  content?: LessonBlockContent;
}

/** Default content for a freshly inserted block of the given type. */
export function defaultBlockContent(type: LessonBlockType): LessonBlockContent {
  switch (type) {
    case "text":
      return { html: "" };
    case "video":
      return { url: null, duration_seconds: null };
    case "image":
      return { url: null, caption_html: null };
    case "file":
      return { url: null, name: null, size: null, description_html: null };
    case "quiz":
      return { quiz_id: null };
    case "assignment":
      return { assignment_id: null, instructions_html: null };
    case "callout":
      return { color: "blue", title: null, body_html: "" };
    case "key_points":
      return { title: "À retenir", items: [""] };
    case "checklist":
      return { title: null, items: [{ id: cryptoRandomId(), label: "" }] };
    case "button":
      return { label: "En savoir plus", url: "", variant: "primary", open_in_new_tab: true };
    case "exercise":
      return { prompt_html: "", answer_html: "" };
    case "self_assessment":
      return {
        prompt: "Comment évaluez-vous votre maîtrise de cette leçon ?",
        scale: "labels",
        labels: ["Pas du tout", "Un peu", "Bien", "Très bien", "Maîtrisé"],
      };
  }
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export { cryptoRandomId };
