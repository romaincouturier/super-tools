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
  | "assignment";

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

export type LessonBlockContent =
  | TextBlockContent
  | VideoBlockContent
  | ImageBlockContent
  | FileBlockContent
  | QuizBlockContent
  | AssignmentBlockContent;

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
  }
}
