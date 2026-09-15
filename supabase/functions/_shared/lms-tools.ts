import { getSupabaseClient } from "./supabase-client.ts";
import {
  getBlockCatalog,
  getCatalogEntry,
  getEditableCatalog,
  isEditableBlockType,
  sanitizeHtml,
  sanitizePlainText,
  sanitizeRestructureBlocks,
  type CatalogEntry,
} from "./lms-block-catalog.ts";

const PAGE_LIMIT_DEFAULT = 25;
const PAGE_LIMIT_MAX = 100;

export interface ListCoursesInput {
  status?: "draft" | "published" | "archived";
  page?: number;
  limit?: number;
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
}

export interface ListLessonsInput {
  courseId: string;
  page?: number;
  limit?: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  description: string | null;
  position: number;
  status: "draft" | "published" | "archived";
  updated_at: string;
  block_count: number;
  fingerprint: string;
}

export interface LessonDetail {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  status: "draft" | "published" | "archived";
  source_transcript_id: string | null;
  blocks: LessonBlock[];
  fingerprint: string;
}

export interface LessonBlock {
  id: string;
  type: string;
  kind: "content" | "layout" | "media" | "assessment" | "embed";
  parent_block_id: string | null;
  position: number;
  hidden: boolean;
  content: Record<string, unknown> | null;
  updated_at: string;
}

export interface VersionSummary {
  id: string;
  created_at: string;
  source: string;
  created_by: string | null;
  block_count: number;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function pageLimit(limit?: number): number {
  if (!limit) return PAGE_LIMIT_DEFAULT;
  return Math.min(Math.max(1, limit), PAGE_LIMIT_MAX);
}

function computeFingerprint(topLevelBlocks: { id: string; updated_at: string; position: number }[]): string {
  const hashable = topLevelBlocks
    .slice()
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map((b) => `${b.id}:${b.updated_at}`)
    .join(";");
  // simple stable hash using Deno built-in crypto
  const bytes = new TextEncoder().encode(hashable);
  const arr = Array.from(bytes).reduce((h, b) => {
    h = ((h << 5) - h + b) | 0;
    return h;
  }, 0);
  return (arr >>> 0).toString(16).padStart(8, "0");
}

async function requireStaffOrService() {
  const supabase = getSupabaseClient();
  const [{ data: isStaff }, { data: isService }] = await Promise.all([
    supabase.rpc("is_staff_user"),
    supabase.rpc("is_service_role"),
  ]);
  if (isStaff || isService) return;
  throw new Error("Permission denied: staff access required");
}

export async function listLmsCourses(input: ListCoursesInput = {}): Promise<{ courses: CourseSummary[]; count: number }> {
  await requireStaffOrService();
  const supabase = getSupabaseClient();
  const limit = pageLimit(input.limit);
  const offset = ((input.page ?? 1) - 1) * limit;

  let query = supabase
    .from("lms_courses")
    .select("id, title, description, status, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list courses: ${error.message}`);

  const courses: CourseSummary[] = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    updated_at: c.updated_at,
  }));

  return { courses, count: count ?? 0 };
}

export async function listLmsLessons(input: ListLessonsInput): Promise<{ lessons: LessonSummary[]; count: number }> {
  const courseId = input.courseId;
  if (!isValidUuid(courseId)) throw new Error("Invalid course_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const limit = pageLimit(input.limit);
  const offset = ((input.page ?? 1) - 1) * limit;

  const { data: lessons, error: lessonsError, count } = await supabase
    .from("lms_lessons")
    .select("id, title, description, position, status, updated_at", { count: "exact" })
    .eq("course_id", courseId)
    .order("position", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (lessonsError) throw new Error(`Failed to list lessons: ${lessonsError.message}`);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: counts } = await supabase
    .from("lms_lesson_blocks")
    .select("lesson_id, id, updated_at, position")
    .in("lesson_id", lessonIds);

  const blocksByLesson = new Map<string, { id: string; updated_at: string; position: number }[]>();
  for (const b of counts ?? []) {
    if (!blocksByLesson.has(b.lesson_id)) blocksByLesson.set(b.lesson_id, []);
    blocksByLesson.get(b.lesson_id)!.push(b);
  }

  const summaries: LessonSummary[] = (lessons ?? []).map((l) => {
    const top = blocksByLesson.get(l.id) ?? [];
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      position: l.position,
      status: l.status,
      updated_at: l.updated_at,
      block_count: top.length,
      fingerprint: computeFingerprint(top),
    };
  });

  return { lessons: summaries, count: count ?? 0 };
}

export async function readLmsLesson(lessonId: string): Promise<LessonDetail> {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const [{ data: lesson, error: lessonError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase.from("lms_lessons").select("id, course_id, title, description, position, status, source_transcript_id, updated_at").eq("id", lessonId).single(),
    supabase.from("lms_lesson_blocks").select("id, type, kind, parent_block_id, position, hidden, content, updated_at").eq("lesson_id", lessonId).order("position", { ascending: true }).order("id", { ascending: true }),
  ]);

  if (lessonError) throw new Error(`Failed to read lesson: ${lessonError.message}`);
  if (blocksError) throw new Error(`Failed to read blocks: ${blocksError.message}`);

  const topLevel = (blocks ?? []).filter((b) => b.parent_block_id === null);
  const fingerprint = computeFingerprint(topLevel.map((b) => ({ id: b.id, updated_at: b.updated_at, position: b.position })));

  return {
    id: lesson.id,
    course_id: lesson.course_id,
    title: lesson.title,
    description: lesson.description,
    position: lesson.position,
    status: lesson.status,
    source_transcript_id: lesson.source_transcript_id,
    blocks: (blocks ?? []).map((b) => ({
      id: b.id,
      type: b.type,
      kind: b.kind as LessonBlock["kind"],
      parent_block_id: b.parent_block_id,
      position: b.position,
      hidden: b.hidden,
      content: b.content as Record<string, unknown> | null,
      updated_at: b.updated_at,
    })),
    fingerprint,
  };
}

export interface UpdateBlockInput {
  blockId: string;
  type: string;
  patch: Record<string, unknown>;
}

export async function updateLmsBlock(input: UpdateBlockInput): Promise<LessonBlock> {
  const { blockId, type, patch } = input;
  if (!isValidUuid(blockId)) throw new Error("Invalid block_id");
  if (!isEditableBlockType(type)) throw new Error(`Block type "${type}" is not editable via MCP`);
  await requireStaffOrService();

  const entry = getCatalogEntry(type);
  if (!entry) throw new Error(`Unknown block type "${type}"`);

  // Only allow textual/HTML fields defined in the catalog.
  const allowedFields = new Set(entry.fields.map((f) => f.name));
  const sanitizedContent: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowedFields.has(key)) continue;
    const field = entry.fields.find((f) => f.name === key)!;
    if (value === null || value === undefined) {
      sanitizedContent[key] = null;
    } else if (field.type === "html") {
      sanitizedContent[key] = sanitizeHtml(String(value));
    } else if (field.type === "plain" || field.type === "string" || field.type === "enum") {
      sanitizedContent[key] = sanitizePlainText(String(value));
    } else if (field.type === "string[]") {
      sanitizedContent[key] = (Array.isArray(value) ? value : [value]).map((v) => (typeof v === "string" ? sanitizePlainText(v) : ""));
    } else if (field.type === "boolean") {
      sanitizedContent[key] = Boolean(value);
    } else if (field.type === "number") {
      const n = Number(value);
      sanitizedContent[key] = Number.isNaN(n) ? 0 : n;
    }
  }

  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.from("lms_lesson_blocks").select("id").eq("id", blockId).maybeSingle();
  if (!existing) throw new Error(`Block ${blockId} not found`);

  const { data, error } = await supabase
    .from("lms_lesson_blocks")
    .update({ content: sanitizedContent, updated_at: new Date().toISOString() })
    .eq("id", blockId)
    .select("id, type, kind, parent_block_id, position, hidden, content, updated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update block");

  return {
    id: data.id,
    type: data.type,
    kind: data.kind as LessonBlock["kind"],
    parent_block_id: data.parent_block_id,
    position: data.position,
    hidden: data.hidden,
    content: data.content as Record<string, unknown> | null,
    updated_at: data.updated_at,
  };
}

export interface ApplyRestructureInput {
  lessonId: string;
  fingerprint: string;
  blocks: unknown[];
  source?: string;
}

export async function applyLessonRestructure(input: ApplyRestructureInput): Promise<{ fingerprint: string; block_count: number }> {
  const { lessonId, fingerprint, blocks, source = "mcp" } = input;
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  if (!Array.isArray(blocks)) throw new Error("blocks must be an array");
  await requireStaffOrService();

  // Sanitize and validate all blocks before sending to DB.
  const sanitized = sanitizeRestructureBlocks(blocks);
  const asJsonb = sanitized.map(({ type, content, hidden }) => ({
    type,
    content,
    hidden: hidden ?? false,
  }));

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("apply_lesson_restructure", {
    p_lesson_id: lessonId,
    p_fingerprint: fingerprint,
    p_blocks: asJsonb,
    p_source: source,
  });

  if (error) throw new Error(`Failed to apply restructure: ${error.message}`);

  const detail = await readLmsLesson(lessonId);
  return { fingerprint: detail.fingerprint, block_count: detail.blocks.filter((b) => b.parent_block_id === null).length };
}

export async function listLessonVersions(lessonId: string, page = 1, limit?: number): Promise<{ versions: VersionSummary[]; count: number }> {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const l = pageLimit(limit);
  const offset = (Math.max(1, page) - 1) * l;

  const { data, error, count } = await supabase
    .from("lms_lesson_snapshots")
    .select("id, created_at, source, created_by, blocks", { count: "exact" })
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .range(offset, offset + l - 1);

  if (error) throw new Error(`Failed to list versions: ${error.message}`);

  const versions: VersionSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    source: row.source,
    created_by: row.created_by,
    block_count: Array.isArray(row.blocks) ? row.blocks.length : 0,
  }));

  return { versions, count: count ?? 0 };
}

export async function restoreLessonVersion(snapshotId: string): Promise<{ lesson_id: string; fingerprint: string }> {
  if (!isValidUuid(snapshotId)) throw new Error("Invalid snapshot_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();

  // Find the lesson_id first for the response.
  const { data: snap } = await supabase.from("lms_lesson_snapshots").select("lesson_id").eq("id", snapshotId).single();
  if (!snap) throw new Error("Snapshot not found");

  const { error } = await supabase.rpc("restore_lesson_version", { p_snapshot_id: snapshotId });
  if (error) throw new Error(`Failed to restore version: ${error.message}`);

  const detail = await readLmsLesson(snap.lesson_id);
  return { lesson_id: snap.lesson_id, fingerprint: detail.fingerprint };
}

export interface CatalogOutput {
  editableTypes: Pick<CatalogEntry, "type" | "kind" | "labelFr" | "fields" | "guidance">[];
  nonEditableTypes: Pick<CatalogEntry, "type" | "kind" | "labelFr" | "guidance">[];
}

export function getLmsBlockCatalog(): CatalogOutput {
  const all = getBlockCatalog();
  const editable = getEditableCatalog().map(({ type, kind, labelFr, fields, guidance }) => ({
    type,
    kind,
    labelFr,
    fields,
    guidance,
  }));
  const nonEditable = all
    .filter((e) => !e.editableViaMcp)
    .map(({ type, kind, labelFr, guidance }) => ({ type, kind, labelFr, guidance }));
  return { editableTypes: editable, nonEditableTypes: nonEditable };
}
