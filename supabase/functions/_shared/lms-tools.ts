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
  lesson_type: string;
  module_id: string;
  module_title: string;
  module_position: number;
  position: number;
  estimated_minutes: number | null;
  updated_at: string;
  block_count: number;
  fingerprint: string;
}

export interface LessonDetail {
  id: string;
  course_id: string | null;
  module_id: string;
  module_title: string | null;
  title: string;
  lesson_type: string;
  position: number;
  estimated_minutes: number | null;
  content_html: string | null;
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

/**
 * The fingerprint is computed by the database (public.lms_lesson_fingerprint), which is
 * also what apply_lesson_restructure compares against. Never recompute it here: any
 * client-side hash would differ from the SQL one and every restructure would be rejected.
 */
async function fetchFingerprint(lessonId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("lms_lesson_fingerprint", { p_lesson_id: lessonId });
  if (error) throw new Error(`Failed to compute fingerprint: ${error.message}`);
  return (data as string) ?? "";
}

async function fetchFingerprints(lessonIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (lessonIds.length === 0) return map;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("lms_lesson_fingerprints", { p_lesson_ids: lessonIds });
  if (error) throw new Error(`Failed to compute fingerprints: ${error.message}`);
  for (const row of (data ?? []) as Array<{ lesson_id: string; fingerprint: string }>) {
    map.set(row.lesson_id, row.fingerprint ?? "");
  }
  return map;
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

  // lms_lessons has no course_id: the course is reached through lms_modules.
  const { data: lessons, error: lessonsError, count } = await supabase
    .from("lms_lessons")
    .select(
      "id, title, lesson_type, position, estimated_minutes, updated_at, module_id, lms_modules!inner(id, title, position, course_id)",
      { count: "exact" },
    )
    .eq("lms_modules.course_id", courseId)
    .order("position", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (lessonsError) throw new Error(`Failed to list lessons: ${lessonsError.message}`);

  const rows = (lessons ?? []) as unknown as Array<Record<string, any>>;
  const lessonIds = rows.map((l) => l.id as string);
  const { data: counts } = lessonIds.length
    ? await supabase
        .from("lms_lesson_blocks")
        .select("lesson_id, id, updated_at, position, parent_block_id")
        .in("lesson_id", lessonIds)
    : { data: [] as any[] };

  const blocksByLesson = new Map<string, { id: string; updated_at: string; position: number }[]>();
  for (const b of (counts ?? []) as any[]) {
    if (b.parent_block_id !== null) continue;
    if (!blocksByLesson.has(b.lesson_id)) blocksByLesson.set(b.lesson_id, []);
    blocksByLesson.get(b.lesson_id)!.push({ id: b.id, updated_at: b.updated_at, position: b.position });
  }

  const fingerprints = await fetchFingerprints(lessonIds);

  const summaries: LessonSummary[] = rows
    .map((l) => {
      const top = blocksByLesson.get(l.id as string) ?? [];
      return {
        id: l.id as string,
        title: l.title as string,
        lesson_type: l.lesson_type as string,
        module_id: l.module_id as string,
        module_title: (l.lms_modules?.title as string) ?? "",
        module_position: (l.lms_modules?.position as number) ?? 0,
        position: (l.position as number) ?? 0,
        estimated_minutes: (l.estimated_minutes as number | null) ?? null,
        updated_at: l.updated_at as string,
        block_count: top.length,
        fingerprint: fingerprints.get(l.id as string) ?? "",
      };
    })
    .sort((a, b) => a.module_position - b.module_position || a.position - b.position);

  return { lessons: summaries, count: count ?? 0 };
}

export async function readLmsLesson(lessonId: string): Promise<LessonDetail> {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  // The course is reached through lms_modules — lms_lessons has no course_id column.
  const [{ data: lessonRow, error: lessonError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase
      .from("lms_lessons")
      .select(
        "id, title, lesson_type, position, estimated_minutes, content_html, source_transcript_id, updated_at, module_id, lms_modules(id, title, course_id)",
      )
      .eq("id", lessonId)
      .single(),
    supabase.from("lms_lesson_blocks").select("id, type, kind, parent_block_id, position, hidden, content, updated_at").eq("lesson_id", lessonId).order("position", { ascending: true }).order("id", { ascending: true }),
  ]);

  if (lessonError) throw new Error(`Failed to read lesson: ${lessonError.message}`);
  if (blocksError) throw new Error(`Failed to read blocks: ${blocksError.message}`);

  const lesson = lessonRow as unknown as Record<string, any>;
  const fingerprint = await fetchFingerprint(lessonId);

  return {
    id: lesson.id,
    course_id: lesson.lms_modules?.course_id ?? null,
    module_id: lesson.module_id,
    module_title: lesson.lms_modules?.title ?? null,
    title: lesson.title,
    lesson_type: lesson.lesson_type,
    position: lesson.position,
    estimated_minutes: lesson.estimated_minutes ?? null,
    content_html: lesson.content_html ?? null,
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

  // Only allow fields defined in the catalog for this type.
  const sanitizedPatch = sanitizeUpdatePatch(type, patch);
  if (Object.keys(sanitizedPatch).length === 0) {
    throw new Error(`No editable field provided for block type "${type}"`);
  }


  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("lms_lesson_blocks")
    .select("id, type, content")
    .eq("id", blockId)
    .maybeSingle();
  if (!existing) throw new Error(`Block ${blockId} not found`);
  // Type changes are NOT supported here: writing another type's content shape under the
  // existing type would silently corrupt the block. Use apply_lesson_restructure instead.
  if (existing.type !== type) {
    throw new Error(
      `Block ${blockId} has type "${existing.type}", not "${type}". update_lms_block cannot change a block type; use apply_lesson_restructure (with a fingerprint and explicit human validation) to convert a block to another type.`,
    );
  }

  // Merge into the existing content so untouched fields (styles, medias) survive.
  const currentContent = (existing.content ?? {}) as Record<string, unknown>;
  const sanitizedContent = { ...currentContent, ...sanitizedPatch };

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

  // Sanitize and validate all blocks (including layout children) before sending to DB.
  const sanitized = sanitizeRestructureBlocks(blocks);
  const toJsonb = (b: SanitizedBlock): Record<string, unknown> => ({
    type: b.type,
    kind: b.kind,
    content: b.content,
    hidden: b.hidden ?? false,
    ...(b.children ? { children: b.children.map(toJsonb) } : {}),
  });
  const asJsonb = sanitized.map(toJsonb);


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

const CREATABLE_LESSON_TYPES = new Set(["text", "content", "image", "file"]);

export interface CreateLessonInput {
  moduleId: string;
  title: string;
  lessonType?: string;
  position?: number;
  estimatedMinutes?: number | null;
  blocks?: unknown[];
}

export async function createLmsLesson(input: CreateLessonInput): Promise<{ lesson: LessonDetail }> {
  const { moduleId, title, lessonType = "text", position, estimatedMinutes, blocks } = input;
  if (!isValidUuid(moduleId)) throw new Error("Invalid module_id");
  const cleanTitle = sanitizePlainText(String(title ?? "")).trim();
  if (!cleanTitle) throw new Error("title is required");
  if (!CREATABLE_LESSON_TYPES.has(lessonType)) {
    throw new Error(`lesson_type "${lessonType}" is not allowed. Use one of: ${[...CREATABLE_LESSON_TYPES].join(", ")}`);
  }
  if (blocks !== undefined && !Array.isArray(blocks)) throw new Error("blocks must be an array");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const { data: mod } = await supabase.from("lms_modules").select("id").eq("id", moduleId).maybeSingle();
  if (!mod) throw new Error(`Module ${moduleId} not found`);

  // Validate blocks BEFORE inserting the lesson, so a bad payload never leaves an empty lesson behind.
  const sanitizedBlocks = blocks && blocks.length > 0 ? sanitizeRestructureBlocks(blocks) : [];

  const { data: siblings } = await supabase
    .from("lms_lessons")
    .select("id, position")
    .eq("module_id", moduleId)
    .order("position", { ascending: true });

  const existing = (siblings ?? []) as { id: string; position: number }[];
  const maxPosition = existing.length > 0 ? existing[existing.length - 1].position : -1;
  const finalPosition = position === undefined || position === null ? maxPosition + 1 : Math.max(0, Math.trunc(position));

  // Insert at an explicit position: shift the following lessons to keep positions unique and ordered.
  if (position !== undefined && position !== null) {
    const toShift = existing.filter((l) => l.position >= finalPosition).sort((a, b) => b.position - a.position);
    for (const l of toShift) {
      const { error: shiftError } = await supabase
        .from("lms_lessons")
        .update({ position: l.position + 1 })
        .eq("id", l.id);
      if (shiftError) throw new Error(`Failed to shift lesson positions: ${shiftError.message}`);
    }
  }

  const { data, error } = await supabase
    .from("lms_lessons")
    .insert({
      module_id: moduleId,
      title: cleanTitle,
      lesson_type: lessonType,
      position: finalPosition,
      estimated_minutes: estimatedMinutes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create lesson: ${error?.message ?? "unknown error"}`);

  if (sanitizedBlocks.length > 0) {
    const fingerprint = await fetchFingerprint(data.id);
    await applyLessonRestructure({
      lessonId: data.id,
      fingerprint,
      blocks: sanitizedBlocks,
      source: "mcp:create_lms_lesson",
    });
  }

  return { lesson: await readLmsLesson(data.id) };
}
