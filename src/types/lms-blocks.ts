/**
 * Composable lesson blocks (ST-2026-0040 + ST-2026-0060).
 *
 * Each lesson is a tree of typed blocks. Two families coexist:
 *   • layout blocks  — structural containers that can host children
 *                      (section, row, container, divider, spacer).
 *   • content blocks — leaves that render an actual piece of content
 *                      (text, video, image, file, callout, key_points,
 *                      checklist, button, exercise, self_assessment,
 *                      work_deposit, quiz, assignment).
 *
 * The tree is materialised in `lms_lesson_blocks` via `parent_block_id`
 * (nullable self-FK) + `position` (sibling order). `kind` discriminates
 * the two families and gates which blocks are allowed as parents.
 */

export type LayoutBlockType =
  | "section"
  | "row"
  | "container"
  | "divider"
  | "spacer";

export type ContentBlockType =
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
  | "self_assessment"
  | "work_deposit";

export type LessonBlockType = LayoutBlockType | ContentBlockType;

export type LessonBlockKind = "layout" | "content";

export const LAYOUT_BLOCK_TYPES: readonly LayoutBlockType[] = [
  "section",
  "row",
  "container",
  "divider",
  "spacer",
] as const;

export function isLayoutBlockType(type: LessonBlockType): type is LayoutBlockType {
  return (LAYOUT_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * Layout blocks that can host children. `divider` and `spacer` are layout
 * blocks (they organise the page) but they are leaves — they never carry
 * children. Used by the editor to decide which blocks expose a drop zone.
 */
export const LAYOUT_CONTAINER_TYPES: readonly LayoutBlockType[] = [
  "section",
  "row",
  "container",
] as const;

export function acceptsChildren(type: LessonBlockType): boolean {
  return (LAYOUT_CONTAINER_TYPES as readonly string[]).includes(type);
}

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

/**
 * Work-deposit block content mirrors the WorkDepositConfig shape from the
 * existing ST-2026-0043 feature so the same renderer (WorkDepositSection)
 * can consume either source.
 */
export interface WorkDepositBlockContent {
  title?: string;
  instructions_html?: string | null;
  expected_deliverable?: string | null;
  accepted_formats?: string[];
  max_size_mb?: number;
  sharing_allowed?: boolean;
  comments_enabled?: boolean;
  feedback_enabled?: boolean;
}

// ── Layout block contents ───────────────────────────────────────────

export type SectionBackground = "default" | "muted" | "primary" | "accent";

export interface SectionBlockContent {
  title?: string | null;
  background?: SectionBackground;
}

export type RowColumnCount = 1 | 2 | 3;

export interface RowBlockContent {
  /** Number of equal-width columns laid out horizontally on desktop. */
  column_count: RowColumnCount;
}

export type ContainerMaxWidth = "sm" | "md" | "lg" | "xl" | "full";

export interface ContainerBlockContent {
  max_width: ContainerMaxWidth;
}

export type DividerStyle = "solid" | "dashed";

export interface DividerBlockContent {
  style: DividerStyle;
}

export interface SpacerBlockContent {
  height_px: number;
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
  | SelfAssessmentBlockContent
  | WorkDepositBlockContent
  | SectionBlockContent
  | RowBlockContent
  | ContainerBlockContent
  | DividerBlockContent
  | SpacerBlockContent;

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: LessonBlockType;
  kind: LessonBlockKind;
  parent_block_id: string | null;
  position: number;
  hidden: boolean;
  content: LessonBlockContent;
  created_at: string;
  updated_at: string;
}

export interface CreateLessonBlockInput {
  lesson_id: string;
  type: LessonBlockType;
  kind: LessonBlockKind;
  parent_block_id?: string | null;
  position: number;
  content: LessonBlockContent;
}

export interface UpdateLessonBlockInput {
  type?: LessonBlockType;
  kind?: LessonBlockKind;
  parent_block_id?: string | null;
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
    case "work_deposit":
      return {
        title: "Déposer mon travail",
        instructions_html: null,
        expected_deliverable: null,
        accepted_formats: ["jpg", "png", "pdf", "video"],
        max_size_mb: 50,
        sharing_allowed: true,
        comments_enabled: true,
        feedback_enabled: true,
      };
    case "section":
      return { title: null, background: "default" };
    case "row":
      return { column_count: 2 };
    case "container":
      return { max_width: "lg" };
    case "divider":
      return { style: "solid" };
    case "spacer":
      return { height_px: 24 };
  }
}

/** Returns the kind ('layout' | 'content') of a block type. */
export function blockKindOf(type: LessonBlockType): LessonBlockKind {
  return isLayoutBlockType(type) ? "layout" : "content";
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export { cryptoRandomId };
